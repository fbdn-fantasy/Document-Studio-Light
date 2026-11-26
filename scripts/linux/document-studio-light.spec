%global __os_install_post %{nil}
%global source_date_epoch_from_changelog 0
%global debug_package %{nil}
%global _build_id_links none
%global _binary_payload w5T2.zstdio
Name: document-studio-light
Version: %{app_version}
Release: 1
Summary: Offline word processor with DOCX and PDF support
License: AGPL-3.0-only
BuildArch: x86_64
AutoReqProv: no
Requires: glibc >= %{glibc_min}
Requires: webkit2gtk4.1, gtk3, openssl-libs, fontconfig
Requires: glib2, libglvnd-glx, libstdc++, libgcc, libgomp, zlib-ng-compat, libX11, libXext, libxcb, dbus-libs
%description
Create, format and print documents with bundled multilingual writing tools.
%install
mkdir -p "%{buildroot}"
cp -a --reflink=auto "$DOCUMENT_STUDIO_PACKAGE_ROOT"/. "%{buildroot}/"
%files
%defattr(-,root,root,-)
/usr/bin/document-studio-light
/usr/bin/Document-Studio-Light-V%{app_version}
"/usr/lib/Document Studio Light"
/usr/share/doc/document-studio-light
/usr/share/applications/com.forbiddenfantasy.DocumentStudioLight.desktop
/usr/share/icons/hicolor/*/apps/com.forbiddenfantasy.DocumentStudioLight.png
