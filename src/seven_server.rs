use hbb_common::config;

pub const HOST: &str = "sevendesk.tech";
pub const API: &str = "https://sevendesk.tech";
pub const PUBLIC_KEY: &str = "WBN+UTprTneKrxbbLyXYo6ASD5shFIhShmA+pbjafvA=";

pub fn allows_server(server: &str) -> bool {
    server.is_empty()
        || server == "public"
        || server.eq_ignore_ascii_case(HOST)
        || server.eq_ignore_ascii_case("sevendesk.tech:21116")
}

pub fn configure() {
    *config::EXE_RENDEZVOUS_SERVER.write().unwrap() = HOST.to_owned();
    *config::PROD_RENDEZVOUS_SERVER.write().unwrap() = HOST.to_owned();
    let mut options = config::OVERWRITE_SETTINGS.write().unwrap();
    for (key, value) in [
        ("custom-rendezvous-server", HOST),
        ("relay-server", HOST),
        ("api-server", API),
        ("key", PUBLIC_KEY),
    ] {
        options.insert(key.to_owned(), value.to_owned());
    }
    drop(options);
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    crate::ui_interface::refresh_options();
}
