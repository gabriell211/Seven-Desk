use hbb_common::config::{self, Config};
use librustdesk::seven_server;

#[test]
fn seven_server_replaces_old_configured_endpoints_and_key() {
    *config::EXE_RENDEZVOUS_SERVER.write().unwrap() = "old.example:21116".to_owned();
    config::OVERWRITE_SETTINGS
        .write()
        .unwrap()
        .insert("key".to_owned(), "old-key".to_owned());

    seven_server::configure();

    assert_eq!(Config::get_rendezvous_server(), "sevendesk.tech:21116");
    assert_eq!(Config::get_rendezvous_servers(), vec!["sevendesk.tech"]);
    assert_eq!(Config::get_option("relay-server"), "sevendesk.tech");
    assert_eq!(Config::get_option("api-server"), "https://sevendesk.tech");
    assert_eq!(Config::get_option("key"), seven_server::PUBLIC_KEY);
    assert_eq!(
        librustdesk::common::get_api_server(
            "https://old.example".to_owned(),
            "old.example".to_owned(),
        ),
        seven_server::API,
    );
}

#[test]
fn only_seven_desk_id_server_is_allowed() {
    for server in ["", "public", "sevendesk.tech", "sevendesk.tech:21116"] {
        assert!(seven_server::allows_server(server));
    }
    for server in [
        "rs-ny.rustdesk.com",
        "sevendesk.tech.example.com",
        "127.0.0.1",
    ] {
        assert!(!seven_server::allows_server(server));
    }
}
