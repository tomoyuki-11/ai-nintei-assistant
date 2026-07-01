use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use axum::extract::FromRef;
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

#[derive(Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub org_id: String,
    pub role: String,
    #[serde(default)]
    pub name: String,
    pub exp: u64,
}

pub fn create_token(
    user_id: Uuid,
    org_id: Uuid,
    role: &str,
    name: &str,
    secret: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = (Utc::now() + chrono::Duration::hours(24)).timestamp() as u64;
    let claims = Claims {
        sub: user_id.to_string(),
        org_id: org_id.to_string(),
        role: role.to_string(),
        name: name.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn verify_token(
    token: &str,
    secret: &str,
) -> Result<Claims, jsonwebtoken::errors::Error> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

pub struct AuthUser {
    pub user_id: Uuid,
    pub organization_id: Uuid,
    pub role: String,
    pub name: String,
}

pub struct AuthSuperAdmin;

impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let state = AppState::from_ref(state);

        let token = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or_else(|| {
                (StatusCode::UNAUTHORIZED, "認証が必要です".to_string())
            })?;

        let claims = verify_token(token, &state.jwt_secret).map_err(|_| {
            (StatusCode::UNAUTHORIZED, "無効なトークンです".to_string())
        })?;

        let user_id = Uuid::parse_str(&claims.sub).map_err(|_| {
            (StatusCode::UNAUTHORIZED, "無効なユーザーIDです".to_string())
        })?;
        let organization_id = Uuid::parse_str(&claims.org_id).map_err(|_| {
            (StatusCode::UNAUTHORIZED, "無効な組織IDです".to_string())
        })?;

        Ok(AuthUser {
            user_id,
            organization_id,
            role: claims.role,
            name: claims.name,
        })
    }
}

impl<S> FromRequestParts<S> for AuthSuperAdmin
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let state = AppState::from_ref(state);

        let token = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or_else(|| (StatusCode::UNAUTHORIZED, "認証が必要です".to_string()))?;

        let claims = verify_token(token, &state.jwt_secret)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "無効なトークンです".to_string()))?;

        if claims.role != "adminTool" {
            return Err((StatusCode::FORBIDDEN, "スーパー管理者権限が必要です".to_string()));
        }

        Ok(AuthSuperAdmin)
    }
}
