#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{collections::HashMap,io::{BufRead,BufReader,Write},process::{Child,ChildStdin,Command,Stdio},sync::{Arc,Mutex,atomic::{AtomicBool,AtomicU64,Ordering}}};
use serde_json::{json,Value};
use tauri::{Emitter,Manager};
#[cfg(target_os = "linux")]
mod wayland_window;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};
fn window_flags() -> StateFlags { StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED }
// Preserve V19's isolated test-profile override for native acceptance tests.
fn test_profile() -> Option<std::path::PathBuf> { std::env::var_os("FTE_TEST_DATA").map(std::path::PathBuf::from).filter(|p|p.is_absolute()) }
fn window_state_file() -> String { test_profile().map(|p|p.join("window-state.json").to_string_lossy().into_owned()).unwrap_or_else(||".window-state.json".into()) }
use tauri_plugin_dialog::{DialogExt,MessageDialogButtons,MessageDialogResult};
use tauri_plugin_opener::OpenerExt;
type Pending=Arc<Mutex<HashMap<u64,tokio::sync::oneshot::Sender<Result<Value,String>>>>>;
struct Service {input:Arc<Mutex<ChildStdin>>,pending:Pending,sequence:AtomicU64,child:Mutex<Child>,closing:AtomicBool}
fn write(input:&Arc<Mutex<ChildStdin>>,value:Value)->Result<(),String>{let mut out=input.lock().map_err(|e|e.to_string())?;writeln!(out,"{value}").map_err(|e|e.to_string())?;out.flush().map_err(|e|e.to_string())}
fn native(app:&tauri::AppHandle,m:&Value)->Result<Value,String>{
 let args=m["args"].as_array().cloned().unwrap_or_default();let opts=args.first().cloned().unwrap_or(Value::Null);
 let window=app.get_webview_window("main").ok_or("Window unavailable")?;
 match m["method"].as_str().unwrap_or("") {
 "open"|"save"=>{let mut d=app.dialog().file().set_parent(&window);if let Some(t)=opts["title"].as_str(){d=d.set_title(t);}if let Some(p)=opts["defaultPath"].as_str(){let p=std::path::Path::new(p);if p.is_dir(){d=d.set_directory(p);}else{if let Some(parent)=p.parent(){d=d.set_directory(parent);}if let Some(name)=p.file_name(){d=d.set_file_name(name.to_string_lossy());}}}if let Some(filters)=opts["filters"].as_array(){for f in filters{let exts:Vec<&str>=f["extensions"].as_array().map(|a|a.iter().filter_map(|v|v.as_str()).collect()).unwrap_or_default();d=d.add_filter(f["name"].as_str().unwrap_or("Files"),&exts);}}
 if m["method"]=="save"{let p=d.blocking_save_file().and_then(|p|p.into_path().ok());Ok(json!({"canceled":p.is_none(),"filePath":p}))}else{let multi=opts["properties"].as_array().map(|a|a.iter().any(|p|p=="multiSelections")).unwrap_or(false);let paths=if multi{d.blocking_pick_files().unwrap_or_default()}else{d.blocking_pick_file().into_iter().collect()};let paths:Vec<_>=paths.into_iter().filter_map(|p|p.into_path().ok()).collect();Ok(json!({"canceled":paths.is_empty(),"filePaths":paths}))}},
 "confirm"=>{let result=app.dialog().message("Save changes before continuing?").title("Document Studio Light").parent(&window).buttons(MessageDialogButtons::YesNoCancelCustom("Save".into(),"Discard changes".into(),"Cancel".into())).blocking_show_with_result();let index=match result{MessageDialogResult::Yes=>0,MessageDialogResult::No=>1,MessageDialogResult::Custom(ref s) if s=="Save"=>0,MessageDialogResult::Custom(ref s) if s=="Discard changes"=>1,_=>2};Ok(json!({"response":index}))},
 "title"=>{window.set_title(opts.as_str().unwrap_or("Document Studio Light")).map_err(|e|e.to_string())?;Ok(Value::Null)},
 _=>Err("Unsupported native operation".into())
 }
}
#[tauri::command]
async fn desktop_command(method:String,args:Vec<Value>,state:tauri::State<'_,Service>)->Result<Value,String>{
 const ALLOWED:&[&str]=&["addPersonal","suggestCJK","analyzeCJK","documentInfo","init","ackRecovery","open","chooseImport","runImport","cancelImport","importHealth","commitOpen","save","saveDocument","export","pdfBytes","pdf","snapshot","recoveries","recover","settings","confirm","dirty","close","recent","dictionaries","dictionary","importDictionary","fonts","spell","spellSuggestions"];
 if !ALLOWED.contains(&method.as_str()){return Err("Unsupported command".into())}
 let id=state.sequence.fetch_add(1,Ordering::Relaxed);let (tx,rx)=tokio::sync::oneshot::channel();state.pending.lock().unwrap().insert(id,tx);if let Err(e)=write(&state.input,json!({"id":id,"method":method,"args":args})){state.pending.lock().unwrap().remove(&id);return Err(e)}
 match tokio::time::timeout(std::time::Duration::from_secs(1900),rx).await{Ok(Ok(r))=>r,_=>{state.pending.lock().unwrap().remove(&id);Err("Desktop service stopped responding".into())}}
}
#[tauri::command]
fn finish_close(app:tauri::AppHandle,state:tauri::State<'_,Service>)->Result<(),String>{app.save_window_state(window_flags()).map_err(|e|e.to_string())?;state.closing.store(true,Ordering::Relaxed);let _=state.child.lock().unwrap().kill();app.exit(0);Ok(())}
#[tauri::command]
fn open_support_page(app:tauri::AppHandle)->Result<(),String>{
 app.opener().open_url("https://ko-fi.com/forbidden_fantasy",None::<&str>).map_err(|error|error.to_string())
}
#[tauri::command]
fn show_main(window:tauri::WebviewWindow)->Result<(),String>{window.show().map_err(|e|e.to_string())?;window.set_focus().map_err(|e|e.to_string())}
fn main(){
 #[cfg(target_os = "linux")]
 gtk::glib::set_prgname(Some("com.forbiddenfantasy.DocumentStudioLight"));
 tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app,args,_cwd|{
 let handle=app.clone();
 let _=app.run_on_main_thread(move||{if let Some(window)=handle.get_webview_window("main"){
  // Keep D-Bus callbacks nonblocking and do not reveal a loading first instance.
  if window.is_visible().unwrap_or(false){let _=window.unminimize();let _=window.set_focus();}
 }});
 if let Some(state)=app.try_state::<Service>(){let _=write(&state.input,json!({"id":0,"method":"externalOpen","args":[args]}));}
 })).plugin(tauri_plugin_window_state::Builder::default().with_state_flags(window_flags()).with_filename(window_state_file()).build()).plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_opener::init()).setup(|app|{
 let window=app.get_webview_window("main").ok_or("Window unavailable")?;
 #[cfg(target_os = "linux")]
 wayland_window::track(&window)?;
 if !app.path().app_config_dir()?.join(window_state_file()).is_file() {
   window.maximize()?;
 }
 if let Some(icon)=app.default_window_icon(){window.set_icon(icon.clone())?;}
 let root=if cfg!(debug_assertions){std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().join("app-resources")}else{app.path().resource_dir()?.join("app-resources")};
 // Tauri returns a verbatim (\\?\) path on Windows. Node's entry-point
 // realpath resolver rejects the drive root in that form. Simplify safely
 // before handing paths to the bundled helper (including paths with spaces).
 let root=dunce::simplified(&root).to_path_buf();
 let data=test_profile().unwrap_or(app.path().app_config_dir()?);std::fs::create_dir_all(&data)?;
 let node=root.join(if cfg!(windows){"node/node.exe"}else{"node/bin/node"});
 let mut command=Command::new(node);command.arg(root.join("desktop-service.cjs")).arg(data).args(std::env::args().skip(1)).current_dir(&root).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit());
 #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
 let mut child=command.spawn()?;let input=Arc::new(Mutex::new(child.stdin.take().unwrap()));let output=child.stdout.take().unwrap();let pending:Pending=Arc::new(Mutex::new(HashMap::new()));
 app.manage(Service{input:input.clone(),pending:pending.clone(),sequence:AtomicU64::new(1),child:Mutex::new(child),closing:AtomicBool::new(false)});
 let handle=app.handle().clone();std::thread::spawn(move||{for line in BufReader::new(output).lines(){let Ok(line)=line else{break};let Ok(m)=serde_json::from_str::<Value>(&line) else{continue};if let Some(id)=m["native"].as_u64(){let h=handle.clone();let i=input.clone();std::thread::spawn(move||{let result=native(&h,&m);let v=match result{Ok(r)=>json!({"nativeReply":id,"result":r}),Err(e)=>json!({"nativeReply":id,"error":e})};let _=write(&i,v);});}else if let Some(id)=m["id"].as_u64(){if let Some(tx)=pending.lock().unwrap().remove(&id){let _=tx.send(if let Some(e)=m["error"].as_str(){Err(e.into())}else{Ok(m["result"].clone())});}}else if m.get("event").is_some(){let _=handle.emit("service-event",m);}}
 for (_,tx) in pending.lock().unwrap().drain(){let _=tx.send(Err("Desktop service exited unexpectedly".into()));}
 });Ok(())
 }).on_window_event(|window,event|{if let tauri::WindowEvent::CloseRequested{api,..}=event{let state=window.state::<Service>();let service_alive=state.child.lock().unwrap().try_wait().map(|s|s.is_none()).unwrap_or(false);if service_alive&&!state.closing.load(Ordering::Relaxed){api.prevent_close();let _=window.emit("service-event",json!({"event":"command","payload":"close"}));}}}).invoke_handler(tauri::generate_handler![desktop_command,finish_close,show_main,open_support_page]).build(tauri::generate_context!()).expect("Could not build Document Studio Light").run(|_app, _event| {
 #[cfg(target_os = "linux")]
 if matches!(_event, tauri::RunEvent::Exit) {
   if let Err(error) = wayland_window::finish(_app) { eprintln!("Could not save Wayland window size: {error}"); }
 }
 });}
