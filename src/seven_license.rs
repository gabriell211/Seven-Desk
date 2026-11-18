//! Seven Desk activation credential for outbound ID/relay requests.
//! Receiving clients need no account and are unaffected.
use hbb_common::{
    config::LocalConfig,
    sha2::{Digest, Sha256},
};

const ACTIVATION_OPTION: &str = "seven-license-token";

fn valid_activation(value: &str) -> bool {
    let suffix = if let Some(s) = value.strip_prefix("sd2_") {
        s
    } else if let Some(s) = value.strip_prefix("sd_") {
        s
    } else {
        return false;
    };
    suffix.len() == 43
        && suffix
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn token_for_device(original: &str, activation: &str, uuid: &[u8]) -> String {
    if !valid_activation(activation) || uuid.is_empty() {
        return original.to_owned();
    }
    let hash = hex::encode(Sha256::digest(uuid));
    format!("{activation}:{hash}")
}


/// Identity displayed to the receiving user is synchronized from the Seven Desk
/// account site before outgoing connections. It is still client-supplied
/// metadata; server-enforced authorization is a separate requirement.
pub fn operator_profile() -> Option<(String, String, String)> {
    let activation = LocalConfig::get_option(ACTIVATION_OPTION);
    if !valid_activation(&activation) {
        return None;
    }
    let profile: serde_json::Value =
        serde_json::from_str(&LocalConfig::get_option("seven-site-profile")).ok()?;
    let name = profile.get("name")?.as_str()?.trim();
    if name.chars().count() < 2
        || name.chars().count() > 100
        || name.chars().any(|c| c.is_control())
    {
        return None;
    }
    let image = profile.get("image").and_then(|v| v.as_str()).unwrap_or("");
    if !image.is_empty()
        && (!image.starts_with("https://www.sevendesk.tech/avatars/")
            || image.len() > 512
            || image.chars().any(|c| c == '?' || c == '#' || c == '@' || c.is_control()))
    {
        return None;
    }
    let company = profile
        .get("companyName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if company.chars().count() > 100 || company.chars().any(|c| c.is_control()) {
        return None;
    }
    Some((name.to_owned(), image.to_owned(), company.to_owned()))
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
    fn generation_two_activation_is_supported_and_bound_to_same_device() {
        let new_code = format!("sd2_{}", "b".repeat(43));
        assert!(valid_activation(&new_code));
        assert!(!valid_activation(&format!("sd3_{}", "b".repeat(43))));
        assert!(!valid_activation(&format!("sd2_{}", "b".repeat(42))));
        let token = token_for_device("legacy", &new_code, b"device-2");
        assert!(token.starts_with(&format!("{}:", new_code)));
        assert_eq!(token.split(':').nth(1).unwrap().len(), 64);
        assert_ne!(token, token_for_device("legacy", &new_code, b"different-device"));
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
