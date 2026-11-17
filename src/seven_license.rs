//! Seven Desk activation credential for outbound ID/relay requests.
//! Receiving clients need no account and are unaffected.
use hbb_common::{
    config::LocalConfig,
    sha2::{Digest, Sha256},
};

const ACTIVATION_OPTION: &str = "seven-license-token";

fn valid_activation(value: &str) -> bool {
    value.len() == 46
        && value.starts_with("sd_")
        && value[3..].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn token_for_device(original: &str, activation: &str, uuid: &[u8]) -> String {
    if !valid_activation(activation) || uuid.is_empty() {
        return original.to_owned();
    }
    let hash = hex::encode(Sha256::digest(uuid));
    format!("{activation}:{hash}")
}

/// Replaces a legacy rendezvous credential only when an operator has explicitly
/// configured a valid Seven Desk activation code. Never log the returned token.
pub fn outbound_token(original: &str) -> String {
    let activation = LocalConfig::get_option(ACTIVATION_OPTION);
    token_for_device(original, &activation, &hbb_common::get_uuid())
}

#[cfg(test)]
mod tests {
    use super::{token_for_device, valid_activation};

    fn code() -> String {
        format!("sd_{}", "a".repeat(43))
    }

    #[test]
    fn activation_token_binds_a_stable_hash_to_one_device() {
        let token = token_for_device("legacy", &code(), b"machine-id-1");
        assert!(token.starts_with(&format!("{}:", code())));
        let hash = token.split(':').nth(1).unwrap();
        assert_eq!(hash.len(), 64);
        assert_eq!(token, token_for_device("legacy", &code(), b"machine-id-1"));
        assert_ne!(token, token_for_device("legacy", &code(), b"machine-id-2"));
    }

    #[test]
    fn missing_or_malformed_tokens_leave_existing_connections_unchanged() {
        assert!(valid_activation(&code()));
        assert_eq!(token_for_device("previous", "", b"id"), "previous");
        assert_eq!(token_for_device("previous", "sd_invalid", b"id"), "previous");
        assert_eq!(token_for_device("previous", &code(), b""), "previous");
        assert_eq!(
            token_for_device("previous", &format!("{}x", code()), b"id"),
            "previous"
        );
    }
}
