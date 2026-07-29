#[cfg(target_os = "linux")]
use tauri::Manager;

#[cfg(target_os = "linux")]
const FRAMELESS_DESKTOPS: &[&str] = &[
    "awesome", "bspwm", "dwl", "hyprland", "i3", "niri", "qtile", "river", "sway", "xmonad",
];

#[cfg(target_os = "linux")]
const FRAMELESS_SESSION_MARKERS: &[&str] = &[
    "HYPRLAND_INSTANCE_SIGNATURE",
    "I3SOCK",
    "NIRI_SOCKET",
    "RIVER_SOCKET",
    "SWAYSOCK",
];

#[cfg(target_os = "linux")]
fn is_frameless_desktop(value: &str) -> bool {
    value
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
        .any(|part| {
            FRAMELESS_DESKTOPS
                .iter()
                .any(|desktop| part.eq_ignore_ascii_case(desktop))
        })
}

#[cfg(target_os = "linux")]
fn should_disable_window_decorations() -> bool {
    FRAMELESS_SESSION_MARKERS
        .iter()
        .any(|name| std::env::var_os(name).is_some())
        || [
            "XDG_CURRENT_DESKTOP",
            "XDG_SESSION_DESKTOP",
            "DESKTOP_SESSION",
        ]
        .iter()
        .filter_map(|name| std::env::var(name).ok())
        .any(|value| is_frameless_desktop(&value))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "linux")]
            if should_disable_window_decorations() {
                if let Some(window) = app.get_webview_window("main") {
                    window.set_decorations(false)?;
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::is_frameless_desktop;

    #[test]
    fn recognizes_tiling_desktop_names_case_insensitively() {
        for desktop in ["Hyprland", "sway", "i3", "NIRI", "river", "bspwm"] {
            assert!(is_frameless_desktop(desktop), "{desktop}");
        }
    }

    #[test]
    fn recognizes_desktop_names_in_composite_session_values() {
        assert!(is_frameless_desktop("ubuntu:Hyprland"));
        assert!(is_frameless_desktop("X-NIXOS;Sway"));
    }

    #[test]
    fn keeps_decorations_on_conventional_desktops() {
        for desktop in ["GNOME", "KDE", "X-Cinnamon", "LXQt"] {
            assert!(!is_frameless_desktop(desktop), "{desktop}");
        }
    }
}
