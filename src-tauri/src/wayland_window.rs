// Tao's Wayland configure size includes GTK client-side decorations. GTK's
// resize API accepts the content area, so saving the configure size makes a
// normal window grow on every restart. Keep the same window-state JSON and
// physical units as the plugin, using the content widget's actual allocation.
use gtk::prelude::*;
use serde_json::Value;
use std::{cell::Cell, fs, io::Write, path::PathBuf, sync::{Arc, Mutex}};
use tauri::Manager;

struct NormalSize {
    state_path: PathBuf,
    last: Arc<Mutex<Option<(i32, i32)>>>,
}

pub fn track(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let native = window.gtk_window()?;
    if native.display().type_().name() != "GdkWaylandDisplay" {
        return Ok(());
    }
    let state_path = window.path().app_config_dir()?.join(super::window_state_file());
    let last = Arc::new(Mutex::new(None));
    let was_maximized = fs::read(&state_path).ok()
        .and_then(|data| serde_json::from_slice::<Value>(&data).ok())
        .and_then(|state| state["main"]["maximized"].as_bool())
        .unwrap_or(false);
    // A saved maximized window can receive temporary normal allocations before
    // the compositor acknowledges its initial maximize request.
    let awaiting_maximize = Cell::new(was_maximized);
    let normal = last.clone();
    window.default_vbox()?.connect_size_allocate(move |widget, allocation| {
        if native.is_maximized() {
            awaiting_maximize.set(false);
            return;
        }
        if awaiting_maximize.get() || allocation.width() <= 1 || allocation.height() <= 1 {
            return;
        }
        let scale = widget.scale_factor();
        if let Ok(mut size) = normal.lock() {
            *size = Some((allocation.width() * scale, allocation.height() * scale));
        }
    });
    window.manage(NormalSize { state_path, last });
    Ok(())
}

// The window-state plugin writes again during RunEvent::Exit. This callback
// runs after that write and preserves its maximized flag and all other fields.
pub fn finish(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let Some(state) = app.try_state::<NormalSize>() else { return Ok(()) };
    let Some((width, height)) = *state.last.lock().map_err(|_| "window size unavailable")? else { return Ok(()) };
    let mut data: Value = serde_json::from_slice(&fs::read(&state.state_path)?)?;
    let main = data.get_mut("main").and_then(Value::as_object_mut).ok_or("main window state missing")?;
    main.insert("width".into(), width.into());
    main.insert("height".into(), height.into());
    let dir = state.state_path.parent().ok_or("window state directory missing")?;
    let mut file = tempfile::NamedTempFile::new_in(dir)?;
    serde_json::to_writer_pretty(&mut file, &data)?;
    file.flush()?;
    file.persist(&state.state_path)?;
    Ok(())
}
