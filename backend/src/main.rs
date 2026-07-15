use axum::{
    extract::{FromRequest, Multipart, Path, State},
    http::{Method, StatusCode},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use axum::http::{HeaderValue, header::{AUTHORIZATION, CONTENT_TYPE, ACCEPT}};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

mod auth;
mod claude;
mod db;
use auth::{create_token, AuthSuperAdmin, AuthUser};
use claude::ClaudeClient;

#[derive(Clone)]
pub struct AppState {
    pub claude: ClaudeClient,
    pub db: PgPool,
    pub jwt_secret: String,
    pub admin_tool_password: String,
    pub stripe_secret_key: String,
    pub stripe_webhook_secret: String,
    pub stripe_price_id: String,
    pub stripe_credit_price_id: String,
    pub stripe_individual_price_id: String,
    pub stripe_individual_credit_price_id: String,
    pub http_client: reqwest::Client,
    pub openai_api_key: String,
}

// ─── Request / Response types ─────────────────────────────────────────────────

#[derive(Deserialize)]
struct SuperAdminLoginRequest {
    password: String,
}

#[derive(Serialize)]
struct TokenResponse {
    token: String,
}

#[derive(Serialize)]
struct LicenseResponse {
    org_id: String,
    org_name: String,
}

#[derive(Deserialize)]
struct CreateStaffRequest {
    email: String,
    password: String,
    role: Option<String>,
    name: Option<String>,
}

#[derive(Deserialize)]
struct CreateOrgRequest {
    name: String,
    plan: String,
    license_expires_at: Option<String>,
    system_prompt: String,
}

#[derive(Serialize)]
struct CreateOrgResponse {
    id: String,
    name: String,
    license_key: String,
    initial_password: String,
}

#[derive(Deserialize)]
struct UpdateOrgRequest {
    name: String,
    system_prompt: String,
    plan: String,
    license_expires_at: Option<String>,
    is_active: bool,
}

#[derive(Deserialize)]
struct SignupRequest {
    org_name: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginRequest {
    org_id: String,
    login_id: String,
    password: String,
}

#[derive(Deserialize)]
struct IndividualAuthRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct ChangePasswordRequest {
    current_password: String,
    new_password: String,
}

#[derive(Serialize)]
struct IndividualAuthResponse {
    token: String,
    is_first_login: bool,
}

#[derive(Serialize)]
struct AuthResponse {
    token: String,
    org_name: String,
    role: String,
}

#[derive(Deserialize)]
struct SaveRequest {
    text: String,
}

#[derive(Serialize)]
struct SaveResponse {
    id: String,
}

#[derive(Deserialize)]
struct FormatRequest {
    text: String,
    id: Option<String>,
    save: Option<bool>,
    save_text: Option<bool>,
}

#[derive(Serialize)]
struct FormatResponse {
    formatted: String,
}

#[derive(Deserialize)]
struct UpdateTextRequest {
    text: String,
}

#[derive(Deserialize)]
struct SaveResultRequest {
    text: String,
    formatted: String,
    id: Option<String>,
    save_text: Option<bool>,
}

#[derive(Serialize)]
struct SettingsResponse {
    transcription_save_mode: String,
    formatted_save_mode: String,
}

#[derive(Deserialize)]
struct UpdateSettingsRequest {
    transcription_save_mode: String,
    formatted_save_mode: String,
}

#[derive(Serialize)]
struct CheckoutSessionResponse {
    url: String,
}

#[derive(Serialize)]
struct PlanStatusResponse {
    plan: String,
    is_expired: bool,
    days_remaining: Option<i64>,
    monthly_usage: i32,
    monthly_limit: Option<i32>,
    is_limit_reached: bool,
    credits: Option<i32>,
    subscription_cancel_at: Option<chrono::DateTime<Utc>>,
}

const TRIAL_MONTHLY_LIMIT: i32 = 3;
const STANDARD_MONTHLY_LIMIT: i32 = 8;

// ─── Main ─────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let anthropic_api_key = std::env::var("ANTHROPIC_API_KEY").expect("ANTHROPIC_API_KEY must be set");
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "dev-secret-change-in-production".to_string());
    let admin_tool_password = std::env::var("SUPERADMIN_PASSWORD")
        .unwrap_or_else(|_| "superadmin1234".to_string());
    let stripe_secret_key = std::env::var("STRIPE_SECRET_KEY").unwrap_or_default();
    let stripe_webhook_secret = std::env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default();
    let stripe_individual_price_id = std::env::var("STRIPE_INDIVIDUAL_PRICE_ID").unwrap_or_default();
    let stripe_individual_credit_price_id = std::env::var("STRIPE_INDIVIDUAL_CREDIT_PRICE_ID").unwrap_or_default();
    let openai_api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
    let stripe_price_id = std::env::var("STRIPE_PRICE_ID")
        .unwrap_or_else(|_| stripe_individual_price_id.clone());
    let stripe_credit_price_id = std::env::var("STRIPE_CREDIT_PRICE_ID")
        .unwrap_or_else(|_| stripe_individual_credit_price_id.clone());

    tracing::info!("DATABASE_URL: {}", database_url);
    tracing::info!("ANTHROPIC_API_KEY: set");

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    tracing::info!("Database connected and migrations applied");

    // 整形完了から5日後に自動削除するバックグラウンドタスク
    let cleanup_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            match db::delete_excel_expired_records(&cleanup_pool).await {
                Ok(n) if n > 0 => tracing::info!("自動削除: {}件の整形済みレコードを削除しました", n),
                Err(e) => tracing::error!("自動削除エラー: {}", e),
                _ => {}
            }
        }
    });

    let state = AppState {
        claude: ClaudeClient::new(anthropic_api_key),
        db: pool,
        jwt_secret,
        admin_tool_password,
        stripe_secret_key,
        stripe_webhook_secret,
        stripe_price_id,
        stripe_credit_price_id,
        stripe_individual_price_id,
        stripe_individual_credit_price_id,
        http_client: reqwest::Client::new(),
        openai_api_key,
    };

    let frontend_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
        .allow_origin(
            frontend_url
                .parse::<HeaderValue>()
                .unwrap_or_else(|_| HeaderValue::from_static("http://localhost:3000")),
        );

    let app = Router::new()
        .route("/health", get(health_handler))
        // スーパー管理者
        .route("/api/adminTool/login", post(admin_tool_login_handler))
        .route("/api/adminTool/organizations", get(admin_tool_list_orgs_handler).post(admin_tool_create_org_handler))
        .route(
            "/api/adminTool/organizations/{id}",
            axum::routing::put(admin_tool_update_org_handler)
                .delete(admin_tool_delete_org_handler),
        )
        .route("/api/adminTool/organizations/{id}/staff", get(admin_tool_list_staff_handler))
        .route("/api/adminTool/individual-users", get(admin_tool_list_individual_users_handler))
        .route("/api/adminTool/individual-users/{user_id}/add-credits", post(admin_tool_add_credits_handler))
        .route("/api/adminTool/individual-users/{user_id}/change-plan", post(admin_tool_change_plan_handler))
        // 個人ユーザー
        .route("/api/individual/register", post(individual_register_handler))
        .route("/api/individual/login", post(individual_login_handler))
        .route("/api/individual/complete-onboarding", post(complete_onboarding_handler))
        // 施設ユーザー
        .route("/api/auth/signup", post(signup_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/auth/license/{key}", get(license_check_handler))
        .route("/api/auth/password", axum::routing::patch(change_password_handler))
        .route("/api/staff", get(list_staff_handler).post(create_staff_handler))
        .route("/api/staff/{id}", axum::routing::delete(delete_staff_handler))
        .route("/api/settings", get(get_settings_handler).patch(update_settings_handler))
        .route("/api/plan-status", get(plan_status_handler))
        .route("/api/stripe/create-checkout-session", post(create_checkout_session_handler))
        .route("/api/stripe/create-credit-checkout", post(create_credit_checkout_handler))
        .route("/api/stripe/customer-portal", post(customer_portal_handler))
        .route("/api/webhook/stripe", post(stripe_webhook_handler))
        .route("/api/save-result", post(save_result_handler))
        .route("/api/transcription", post(save_transcription_handler))
        .route("/api/transcribe", post(transcribe_handler))
        .route("/api/format", post(format_handler))
        .route("/api/history", get(history_handler))
        .route(
            "/api/history/{id}",
            axum::routing::put(update_text_handler).delete(delete_handler),
        )
        .route("/api/history/{id}/text", axum::routing::delete(delete_text_handler))
        .route("/api/history/{id}/formatted", axum::routing::delete(delete_formatted_handler))
        .route("/api/history/{id}/mark-downloaded", post(mark_downloaded_handler))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    tracing::info!("Server running on http://0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}

// ─── Excel ダウンロード済みマーク ─────────────────────────────────────────────

async fn mark_downloaded_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    db::mark_excel_downloaded(&state.db, id, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

// ─── Whisper 文字起こし ───────────────────────────────────────────────────────

async fn transcribe_handler(
    State(state): State<AppState>,
    _auth: AuthUser,
    req: axum::extract::Request,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    tracing::info!("/api/transcribe リクエスト受信");
    if state.openai_api_key.is_empty() {
        tracing::error!("OPENAI_API_KEY が設定されていません");
        return Err((StatusCode::SERVICE_UNAVAILABLE, "OPENAI_API_KEY が設定されていません".to_string()));
    }

    let content_type = req.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    tracing::info!("Content-Type: {}", content_type);

    let (audio_data, mime_type) = if content_type.starts_with("multipart/") {
        let mut multipart = Multipart::from_request(req, &state).await
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

        let mut audio_bytes: Option<Vec<u8>> = None;
        let mut mime = "audio/webm".to_string();

        while let Some(field) = multipart.next_field().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? {
            if field.name().unwrap_or("") == "audio" {
                mime = field.content_type().unwrap_or("audio/webm").to_string();
                let data = field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
                audio_bytes = Some(data.to_vec());
            }
        }

        let audio = audio_bytes.ok_or_else(|| (StatusCode::BAD_REQUEST, "音声データが見つかりません".to_string()))?;
        (audio, mime)
    } else {
        // iOS Safari: Blob を直接送信（FormData なし）
        let mime = content_type.split(';').next().unwrap_or("audio/mp4").trim().to_string();
        let bytes = axum::body::to_bytes(req.into_body(), 100 * 1024 * 1024)
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
        (bytes.to_vec(), mime)
    };

    tracing::info!("音声データ: {} bytes, mime: {}", audio_data.len(), mime_type);

    let ext = if mime_type.contains("ogg") { "ogg" }
              else if mime_type.contains("flac") { "flac" }
              else if mime_type.contains("m4a") { "m4a" }
              else if mime_type.contains("mp4") { "mp4" }
              else if mime_type.contains("mpeg") || mime_type.contains("mp3") { "mp3" }
              else if mime_type.contains("wav") { "wav" }
              else { "webm" };
    let filename = format!("audio.{}", ext);

    let whisper_mime = match ext {
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "m4a" | "mp4" => "audio/mp4",
        "mp3" | "mpeg" | "mpga" => "audio/mpeg",
        "wav" => "audio/wav",
        _ => "audio/webm",
    };

    tracing::info!("Whisper送信: filename={}, whisper_mime={}", filename, whisper_mime);

    let part = reqwest::multipart::Part::bytes(audio_data)
        .file_name(filename)
        .mime_str(whisper_mime)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-1")
        .text("language", "ja");

    let response = state.http_client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", state.openai_api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        tracing::error!("Whisper API error {}: {}", status, body);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "文字起こしに失敗しました".to_string()));
    }

    let data: serde_json::Value = response.json().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tracing::info!("Whisper 成功");
    Ok(Json(serde_json::json!({ "text": data["text"] })))
}

// ─── ヘルス ───────────────────────────────────────────────────────────────────

async fn health_handler() -> &'static str {
    "OK"
}

// ─── スーパー管理者ハンドラー ─────────────────────────────────────────────────

async fn admin_tool_login_handler(
    State(state): State<AppState>,
    Json(body): Json<SuperAdminLoginRequest>,
) -> Result<Json<TokenResponse>, (StatusCode, String)> {
    if body.password != state.admin_tool_password {
        return Err((StatusCode::UNAUTHORIZED, "パスワードが正しくありません".to_string()));
    }

    let token = create_token(Uuid::nil(), Uuid::nil(), "adminTool", "", &state.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(TokenResponse { token }))
}

async fn admin_tool_list_orgs_handler(
    State(state): State<AppState>,
    _: AuthSuperAdmin,
) -> Result<Json<Vec<db::Organization>>, (StatusCode, String)> {
    let orgs = db::list_all_organizations(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(orgs))
}

async fn admin_tool_create_org_handler(
    State(state): State<AppState>,
    _: AuthSuperAdmin,
    Json(body): Json<CreateOrgRequest>,
) -> Result<Json<CreateOrgResponse>, (StatusCode, String)> {
    let license_expires_at = parse_date(body.license_expires_at)?;

    let initial_password = generate_password();
    let password_hash = hash_password(&initial_password).await?;

    let org_id = db::create_organization(
        &state.db,
        &body.name,
        &body.system_prompt,
        &body.plan,
        license_expires_at,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    db::create_user(&state.db, org_id, "admin", &password_hash, "admin", "")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let org = db::get_organization(&state.db, org_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "作成した施設が見つかりません".to_string()))?;

    Ok(Json(CreateOrgResponse {
        id: org.id.to_string(),
        name: org.name,
        license_key: org.license_key,
        initial_password,
    }))
}

async fn admin_tool_update_org_handler(
    State(state): State<AppState>,
    _: AuthSuperAdmin,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOrgRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let license_expires_at = parse_date(body.license_expires_at)?;

    db::update_organization(
        &state.db,
        id,
        &body.name,
        &body.system_prompt,
        &body.plan,
        license_expires_at,
        body.is_active,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

async fn admin_tool_delete_org_handler(
    State(state): State<AppState>,
    _: AuthSuperAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    db::delete_organization(&state.db, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn admin_tool_list_staff_handler(
    State(state): State<AppState>,
    _: AuthSuperAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<db::UserInfo>>, (StatusCode, String)> {
    let users = db::list_users_by_org(&state.db, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(users))
}

async fn admin_tool_list_individual_users_handler(
    State(state): State<AppState>,
    _: AuthSuperAdmin,
) -> Result<Json<Vec<db::IndividualUserAdmin>>, (StatusCode, String)> {
    let users = db::list_individual_users(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(users))
}

#[derive(serde::Deserialize)]
struct AddCreditsRequest {
    amount: i32,
}

async fn admin_tool_add_credits_handler(
    State(state): State<AppState>,
    _: AuthSuperAdmin,
    Path(user_id): Path<Uuid>,
    Json(body): Json<AddCreditsRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    if body.amount <= 0 {
        return Err((StatusCode::BAD_REQUEST, "1以上の数値を指定してください".to_string()));
    }
    db::add_credits_for_individual_user(&state.db, user_id, body.amount)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

#[derive(serde::Deserialize)]
struct ChangePlanRequest {
    plan: String,
}

async fn admin_tool_change_plan_handler(
    State(state): State<AppState>,
    _: AuthSuperAdmin,
    Path(user_id): Path<Uuid>,
    Json(body): Json<ChangePlanRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let allowed = ["trial", "metered", "monthly", "dev"];
    if !allowed.contains(&body.plan.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "無効なプランです".to_string()));
    }
    db::update_plan_for_individual_user(&state.db, user_id, &body.plan)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

// ─── 施設ユーザーハンドラー ───────────────────────────────────────────────────

async fn license_check_handler(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> Result<Json<LicenseResponse>, (StatusCode, String)> {
    let org = db::find_org_by_license_key(&state.db, &key)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "ライセンスキーが見つかりません".to_string()))?;

    if !org.is_active {
        return Err((StatusCode::FORBIDDEN, "このライセンスは無効化されています".to_string()));
    }
    if let Some(expires_at) = org.license_expires_at {
        if expires_at < Utc::now() {
            return Err((StatusCode::FORBIDDEN, "ライセンスの有効期限が切れています".to_string()));
        }
    }

    Ok(Json(LicenseResponse {
        org_id: org.id.to_string(),
        org_name: org.name,
    }))
}

async fn list_staff_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<db::UserInfo>>, (StatusCode, String)> {
    if auth.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "管理者権限が必要です".to_string()));
    }
    let users = db::list_users_by_org(&state.db, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(users))
}

async fn create_staff_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateStaffRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    if auth.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "管理者権限が必要です".to_string()));
    }
    let role = body.role.as_deref().unwrap_or("member");
    if role != "admin" && role != "member" {
        return Err((StatusCode::BAD_REQUEST, "ロールは admin または member を指定してください".to_string()));
    }
    let name = body.name.as_deref().unwrap_or("");
    let password_hash = hash_password(&body.password).await?;
    db::create_user(&state.db, auth.organization_id, &body.email, &password_hash, role, name)
        .await
        .map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                (StatusCode::CONFLICT, "このログインIDは既に使用されています".to_string())
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            }
        })?;
    Ok(StatusCode::CREATED)
}

async fn delete_staff_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    if auth.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "管理者権限が必要です".to_string()));
    }
    if id == auth.user_id {
        return Err((StatusCode::BAD_REQUEST, "自分自身は削除できません".to_string()));
    }
    db::delete_user(&state.db, id, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn signup_handler(
    State(state): State<AppState>,
    Json(body): Json<SignupRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let password_hash = hash_password(&body.password).await?;

    let trial_expires_at = Some(Utc::now() + Duration::days(14));
    let org_id = db::create_organization(&state.db, &body.org_name, "", "trial", trial_expires_at)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_id = db::create_user(&state.db, org_id, &body.email, &password_hash, "admin", "")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let token = create_token(user_id, org_id, "admin", "", &state.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(AuthResponse {
        token,
        org_name: body.org_name,
        role: "admin".to_string(),
    }))
}

async fn individual_register_handler(
    State(state): State<AppState>,
    Json(body): Json<IndividualAuthRequest>,
) -> Result<Json<IndividualAuthResponse>, (StatusCode, String)> {
    if db::find_individual_user_by_email(&state.db, &body.email)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .is_some()
    {
        return Err((StatusCode::CONFLICT, "このメールアドレスはすでに登録されています".to_string()));
    }

    let password_hash = hash_password(&body.password).await?;
    let (user_id, org_id) = db::create_individual_user(&state.db, &body.email, &password_hash)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let token = create_token(user_id, org_id, "individual", &body.email, &state.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(IndividualAuthResponse { token, is_first_login: true }))
}

async fn individual_login_handler(
    State(state): State<AppState>,
    Json(body): Json<IndividualAuthRequest>,
) -> Result<Json<IndividualAuthResponse>, (StatusCode, String)> {
    let user = db::find_individual_user_by_email(&state.db, &body.email)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "メールアドレスまたはパスワードが正しくありません".to_string()))?;

    let hash = user.password_hash.clone();
    let password = body.password.clone();
    let valid = tokio::task::spawn_blocking(move || bcrypt::verify(&password, &hash))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !valid {
        return Err((StatusCode::UNAUTHORIZED, "メールアドレスまたはパスワードが正しくありません".to_string()));
    }

    let is_first_login = user.is_first_login;
    let token = create_token(user.id, user.organization_id, "individual", &user.name, &state.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(IndividualAuthResponse { token, is_first_login }))
}

async fn change_password_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<ChangePasswordRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    if body.new_password.len() < 6 {
        return Err((StatusCode::BAD_REQUEST, "新しいパスワードは6文字以上にしてください".to_string()));
    }

    let current_hash = db::get_user_password_hash(&state.db, auth.user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "ユーザーが見つかりません".to_string()))?;

    let current_password = body.current_password.clone();
    let valid = tokio::task::spawn_blocking(move || bcrypt::verify(&current_password, &current_hash))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !valid {
        return Err((StatusCode::UNAUTHORIZED, "現在のパスワードが正しくありません".to_string()));
    }

    let new_hash = hash_password(&body.new_password).await?;
    db::update_user_password(&state.db, auth.user_id, &new_hash)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

async fn complete_onboarding_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<StatusCode, (StatusCode, String)> {
    db::complete_individual_onboarding(&state.db, auth.user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn login_handler(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    let org_id = Uuid::parse_str(&body.org_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "無効な事業所IDです".to_string()))?;

    let user = db::find_user_by_login_in_org(&state.db, &body.login_id, org_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| {
            (StatusCode::UNAUTHORIZED, "ログインIDまたはパスワードが正しくありません".to_string())
        })?;

    let hash = user.password_hash.clone();
    let password = body.password.clone();
    let valid = tokio::task::spawn_blocking(move || bcrypt::verify(&password, &hash))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !valid {
        return Err((
            StatusCode::UNAUTHORIZED,
            "メールアドレスまたはパスワードが正しくありません".to_string(),
        ));
    }

    let org = db::get_organization(&state.db, user.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "組織が見つかりません".to_string()))?;

    if !org.is_active {
        return Err((StatusCode::FORBIDDEN, "このアカウントは無効化されています".to_string()));
    }
    if let Some(expires_at) = org.license_expires_at {
        if expires_at < Utc::now() {
            return Err((StatusCode::FORBIDDEN, "ライセンスの有効期限が切れています".to_string()));
        }
    }

    let token = create_token(user.id, user.organization_id, &user.role, &user.name, &state.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(AuthResponse {
        token,
        org_name: org.name,
        role: user.role,
    }))
}

async fn plan_status_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<PlanStatusResponse>, (StatusCode, String)> {
    let org = db::get_organization(&state.db, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "組織が見つかりません".to_string()))?;

    let now = Utc::now();
    let year_month = now.format("%Y-%m").to_string();

    let is_expired = org.license_expires_at.map(|exp| exp < now).unwrap_or(false);
    let days_remaining = org.license_expires_at.map(|exp| (exp - now).num_days());

    let monthly_usage = db::get_monthly_usage(&state.db, org.id, &year_month)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let monthly_limit = match org.plan.as_str() {
        "trial" => Some(TRIAL_MONTHLY_LIMIT),
        "monthly" => Some(STANDARD_MONTHLY_LIMIT),
        _ => None,
    };
    let is_limit_reached = monthly_limit.map(|limit| monthly_usage >= limit).unwrap_or(false);

    let credits = if org.plan == "metered" || org.plan == "monthly" || org.plan == "trial" {
        Some(
            db::get_org_credits(&state.db, org.id)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        )
    } else {
        None
    };

    // subscription_cancel_at が未設定の月額ユーザーはStripeに問い合わせて補完
    let subscription_cancel_at = if org.plan == "monthly"
        && org.subscription_cancel_at.is_none()
        && !state.stripe_secret_key.is_empty()
    {
        if let Some(ref sub_id) = org.stripe_subscription_id {
            let stripe_res = state
                .http_client
                .get(format!("https://api.stripe.com/v1/subscriptions/{}", sub_id))
                .basic_auth(&state.stripe_secret_key, Some(""))
                .send()
                .await
                .ok();
            if let Some(res) = stripe_res {
                if let Ok(sub) = res.json::<serde_json::Value>().await {
                    // cancel_at_period_end または cancel_at で解約予約を検出
                    let cancel_ts = if sub["cancel_at_period_end"].as_bool().unwrap_or(false) {
                        sub["current_period_end"].as_i64()
                    } else {
                        sub["cancel_at"].as_i64()
                    };
                    if let Some(ts) = cancel_ts {
                        let cancel_at = chrono::DateTime::from_timestamp(ts, 0);
                        if let Some(dt) = cancel_at {
                            sqlx::query(
                                "UPDATE organizations SET subscription_cancel_at = $1 WHERE id = $2",
                            )
                            .bind(dt)
                            .bind(org.id)
                            .execute(&state.db)
                            .await
                            .ok();
                        }
                        cancel_at
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        org.subscription_cancel_at
    };

    Ok(Json(PlanStatusResponse {
        plan: org.plan,
        is_expired,
        days_remaining,
        monthly_usage,
        monthly_limit,
        is_limit_reached,
        credits,
        subscription_cancel_at,
    }))
}

async fn get_settings_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<SettingsResponse>, (StatusCode, String)> {
    let settings = db::get_org_settings(&state.db, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "組織が見つかりません".to_string()))?;
    Ok(Json(SettingsResponse {
        transcription_save_mode: settings.transcription_save_mode,
        formatted_save_mode: settings.formatted_save_mode,
    }))
}

async fn update_settings_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdateSettingsRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    if auth.role != "admin" && auth.role != "individual" {
        return Err((StatusCode::FORBIDDEN, "権限が必要です".to_string()));
    }
    let valid_modes = ["auto", "confirm"];
    if !valid_modes.contains(&body.transcription_save_mode.as_str())
        || !valid_modes.contains(&body.formatted_save_mode.as_str())
    {
        return Err((StatusCode::BAD_REQUEST, "無効な設定値です".to_string()));
    }
    db::update_org_settings(
        &state.db,
        auth.organization_id,
        &body.transcription_save_mode,
        &body.formatted_save_mode,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn save_result_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<SaveResultRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let org = db::get_organization(&state.db, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let year_month = Utc::now().format("%Y-%m").to_string();
    let mut use_extra_credit = false;

    // 使用回数インクリメント・クレジット消費
    if let Some(ref o) = org {
        if o.plan == "metered" {
            use_extra_credit = true;
        }
        let plan_limit = match o.plan.as_str() {
            "trial" => Some(TRIAL_MONTHLY_LIMIT),
            "monthly" => Some(STANDARD_MONTHLY_LIMIT),
            _ => None,
        };
        if let Some(limit) = plan_limit {
            if o.plan == "monthly" || o.plan == "trial" {
                let usage = db::get_monthly_usage(&state.db, o.id, &year_month)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                if usage >= limit {
                    use_extra_credit = true;
                }
            }
        }
        let _ = db::increment_usage(&state.db, o.id, &year_month).await;
        if use_extra_credit {
            let _ = db::deduct_credit(&state.db, o.id).await;
        }
    }

    match body.id.as_deref().and_then(|s| Uuid::parse_str(s).ok()) {
        Some(id) => {
            db::update_formatted(&state.db, id, &body.formatted, auth.organization_id)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
        None => {
            if body.save_text.unwrap_or(true) {
                db::save_transcription(&state.db, &body.text, &body.formatted, auth.organization_id, &auth.name)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            } else {
                db::save_formatted_only(&state.db, &body.formatted, auth.organization_id, &auth.name)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            }
        }
    }
    Ok(StatusCode::OK)
}

async fn save_transcription_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<SaveRequest>,
) -> Result<Json<SaveResponse>, (StatusCode, String)> {
    let id = db::save_text_only(&state.db, &body.text, auth.organization_id, &auth.name)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(SaveResponse { id: id.to_string() }))
}

async fn format_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<FormatRequest>,
) -> Result<Json<FormatResponse>, (StatusCode, String)> {
    let org = db::get_organization(&state.db, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let year_month = Utc::now().format("%Y-%m").to_string();
    let mut use_extra_credit = false;

    // プラン制限チェック
    if let Some(ref o) = org {
        if let Some(expires_at) = o.license_expires_at {
            if expires_at < Utc::now() {
                return Err((StatusCode::FORBIDDEN, "ライセンスの有効期限が切れています".to_string()));
            }
        }
        if o.plan == "metered" {
            let credits = db::get_org_credits(&state.db, o.id)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            if credits <= 0 {
                return Err((StatusCode::PAYMENT_REQUIRED, "クレジットが不足しています。クレジットを購入してください".to_string()));
            }
            use_extra_credit = true;
        }
        let plan_limit = match o.plan.as_str() {
            "trial" => Some(TRIAL_MONTHLY_LIMIT),
            "monthly" => Some(STANDARD_MONTHLY_LIMIT),
            _ => None,
        };
        if let Some(limit) = plan_limit {
            let usage = db::get_monthly_usage(&state.db, o.id, &year_month)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            if usage >= limit {
                // monthly・trial ともにクレジットで継続利用可能
                let credits = db::get_org_credits(&state.db, o.id)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                if credits <= 0 {
                    return Err((StatusCode::PAYMENT_REQUIRED, format!(
                        "使用回数の上限（{}回）に達しました。クレジットを購入するかプランをアップグレードしてください",
                        limit
                    )));
                }
                use_extra_credit = true;
            }
        }
    }

    let custom_prompt = org.as_ref().map(|o| o.system_prompt.as_str());

    let formatted = state
        .claude
        .format_transcription(&body.text, custom_prompt)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // 保存・課金はクライアントが結果を受け取った後に /api/save-result で行う
    Ok(Json(FormatResponse { formatted }))
}

async fn history_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<db::Transcription>>, (StatusCode, String)> {
    let history = db::list_transcriptions(&state.db, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(history))
}

async fn update_text_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTextRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    db::update_text(&state.db, id, &body.text, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn delete_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    db::delete_transcription(&state.db, id, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn delete_text_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    db::clear_text(&state.db, id, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

async fn delete_formatted_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    db::clear_formatted(&state.db, id, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::OK)
}

// ─── ヘルパー関数 ──────────────────────────────────────────────────────────────

fn generate_password() -> String {
    let u = Uuid::new_v4().to_string().replace("-", "");
    u[..12].to_string()
}

fn parse_date(s: Option<String>) -> Result<Option<DateTime<Utc>>, (StatusCode, String)> {
    match s {
        None => Ok(None),
        Some(v) if v.is_empty() => Ok(None),
        Some(v) => {
            let dt = format!("{}T00:00:00Z", v);
            dt.parse::<DateTime<Utc>>()
                .map(Some)
                .map_err(|_| (StatusCode::BAD_REQUEST, "日付の形式が正しくありません (YYYY-MM-DD)".to_string()))
        }
    }
}

async fn hash_password(password: &str) -> Result<String, (StatusCode, String)> {
    let pw = password.to_string();
    tokio::task::spawn_blocking(move || bcrypt::hash(&pw, bcrypt::DEFAULT_COST))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

async fn create_checkout_session_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<CheckoutSessionResponse>, (StatusCode, String)> {
    if state.stripe_secret_key.is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "Stripe未設定です".to_string()));
    }
    let price_id = if auth.role == "individual" {
        if !state.stripe_individual_price_id.is_empty() { &state.stripe_individual_price_id } else { &state.stripe_price_id }
    } else {
        if !state.stripe_price_id.is_empty() { &state.stripe_price_id } else { &state.stripe_individual_price_id }
    };
    if price_id.is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "Stripe Price ID未設定です".to_string()));
    }

    let frontend_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let org_id_str = auth.organization_id.to_string();
    let success_url = format!("{}/?checkout=success", frontend_url);
    let cancel_url = frontend_url;

    let mut param_vec: Vec<(&str, &str)> = vec![
        ("mode", "subscription"),
        ("line_items[0][price]", price_id.as_str()),
        ("line_items[0][quantity]", "1"),
        ("success_url", success_url.as_str()),
        ("cancel_url", cancel_url.as_str()),
        ("metadata[org_id]", org_id_str.as_str()),
    ];
    if auth.role == "individual" && !auth.name.is_empty() {
        param_vec.push(("customer_email", auth.name.as_str()));
    }
    let params = param_vec;

    let encoded_body = serde_urlencoded::to_string(&params)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = state
        .http_client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .basic_auth(&state.stripe_secret_key, Some(""))
        .header("content-type", "application/x-www-form-urlencoded")
        .body(encoded_body)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Stripe error: {}", err_body)));
    }

    let session: serde_json::Value = response
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let url = session["url"]
        .as_str()
        .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "Stripe response に URL が含まれていません".to_string()))?
        .to_string();

    Ok(Json(CheckoutSessionResponse { url }))
}

async fn create_credit_checkout_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<CheckoutSessionResponse>, (StatusCode, String)> {
    if state.stripe_secret_key.is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "Stripe未設定です".to_string()));
    }
    let credit_price_id = if auth.role == "individual" {
        if !state.stripe_individual_credit_price_id.is_empty() { &state.stripe_individual_credit_price_id } else { &state.stripe_credit_price_id }
    } else {
        if !state.stripe_credit_price_id.is_empty() { &state.stripe_credit_price_id } else { &state.stripe_individual_credit_price_id }
    };
    if credit_price_id.is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "Stripe Credit Price ID未設定です".to_string()));
    }

    let frontend_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let org_id_str = auth.organization_id.to_string();
    let success_url = format!("{}/?checkout=credit", frontend_url);
    let cancel_url = frontend_url;

    let mut param_vec: Vec<(&str, &str)> = vec![
        ("mode", "payment"),
        ("line_items[0][price]", credit_price_id.as_str()),
        ("line_items[0][quantity]", "1"),
        ("success_url", success_url.as_str()),
        ("cancel_url", cancel_url.as_str()),
        ("metadata[org_id]", org_id_str.as_str()),
        ("metadata[credits]", "1"),
    ];
    if auth.role == "individual" && !auth.name.is_empty() {
        param_vec.push(("customer_email", auth.name.as_str()));
    }
    let params = param_vec;

    let encoded_body = serde_urlencoded::to_string(&params)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = state
        .http_client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .basic_auth(&state.stripe_secret_key, Some(""))
        .header("content-type", "application/x-www-form-urlencoded")
        .body(encoded_body)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !response.status().is_success() {
        let err_body = response.text().await.unwrap_or_default();
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Stripe error: {}", err_body)));
    }

    let session: serde_json::Value = response
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let url = session["url"]
        .as_str()
        .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "Stripe response に URL が含まれていません".to_string()))?
        .to_string();

    Ok(Json(CheckoutSessionResponse { url }))
}

async fn customer_portal_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<CheckoutSessionResponse>, (StatusCode, String)> {
    let customer_id = db::get_stripe_customer_id(&state.db, auth.organization_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Stripeカスタマーが見つかりません。先に月額プランを契約してください。".to_string()))?;

    let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let return_url = format!("{}/plan", frontend_url);

    let encoded_body = serde_urlencoded::to_string(&[
        ("customer", customer_id.as_str()),
        ("return_url", return_url.as_str()),
    ])
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let res = state
        .http_client
        .post("https://api.stripe.com/v1/billing_portal/sessions")
        .basic_auth(&state.stripe_secret_key, Some(""))
        .header("content-type", "application/x-www-form-urlencoded")
        .body(encoded_body)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Stripe error: {}", err_body)));
    }

    let session: serde_json::Value = res
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let url = session["url"]
        .as_str()
        .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "Stripe response に URL が含まれていません".to_string()))?
        .to_string();

    Ok(Json(CheckoutSessionResponse { url }))
}

async fn stripe_webhook_handler(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    body: axum::body::Bytes,
) -> Result<StatusCode, (StatusCode, String)> {
    let sig_header = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Stripe-Signature ヘッダーがありません".to_string()))?;

    if !state.stripe_webhook_secret.is_empty()
        && !verify_stripe_signature(&body, sig_header, &state.stripe_webhook_secret)
    {
        return Err((StatusCode::UNAUTHORIZED, "Webhook シグネチャが無効です".to_string()));
    }

    let event: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let event_type = event["type"].as_str().unwrap_or("");
    tracing::info!("Stripe webhook: {}", event_type);

    match event_type {
        "checkout.session.completed" => {
            let session = &event["data"]["object"];
            let mode = session["mode"].as_str().unwrap_or("");
            let metadata = &session["metadata"];

            if let Some(org_id_str) = metadata["org_id"].as_str() {
                if let Ok(org_id) = Uuid::parse_str(org_id_str) {
                    match mode {
                        "subscription" => {
                            let customer_id = session["customer"].as_str().unwrap_or("").to_string();
                            let subscription_id = session["subscription"].as_str().unwrap_or("").to_string();
                            db::upgrade_org_to_monthly(&state.db, org_id, &customer_id, &subscription_id)
                                .await
                                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                            let year_month = Utc::now().format("%Y-%m").to_string();
                            let _ = db::reset_monthly_usage(&state.db, org_id, &year_month).await;
                            tracing::info!("Org {} → monthly プランに更新・今月の使用回数をリセット", org_id_str);
                        }
                        "payment" => {
                            let credits: i32 = metadata["credits"]
                                .as_str()
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(1);
                            db::add_credits(&state.db, org_id, credits)
                                .await
                                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                            tracing::info!("Org {} に {}クレジット追加", org_id_str, credits);
                        }
                        _ => {}
                    }
                }
            }
        }
        "customer.subscription.updated" => {
            let subscription = &event["data"]["object"];
            let customer_id = subscription["customer"].as_str().unwrap_or("");
            if !customer_id.is_empty() {
                // cancel_at_period_end または cancel_at で解約予約を検出
                let cancel_ts = if subscription["cancel_at_period_end"].as_bool().unwrap_or(false) {
                    subscription["current_period_end"].as_i64()
                } else {
                    subscription["cancel_at"].as_i64()
                };
                let cancel_at = cancel_ts.and_then(|ts| chrono::DateTime::from_timestamp(ts, 0));
                db::set_subscription_cancel_at(&state.db, customer_id, cancel_at)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                tracing::info!("Customer {} の解約予約更新: {:?}", customer_id, cancel_at);
            }
        }
        "customer.subscription.deleted" => {
            let customer_id = event["data"]["object"]["customer"].as_str().unwrap_or("");
            if !customer_id.is_empty() {
                db::revert_org_plan_by_customer(&state.db, customer_id)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                tracing::info!("Customer {} のサブスクリプション解約", customer_id);
            }
        }
        _ => {}
    }

    Ok(StatusCode::OK)
}

fn verify_stripe_signature(payload: &[u8], sig_header: &str, secret: &str) -> bool {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let mut timestamp_str = None;
    let mut expected_sig = None;

    for part in sig_header.split(',') {
        if let Some(t) = part.strip_prefix("t=") {
            timestamp_str = Some(t);
        } else if let Some(v) = part.strip_prefix("v1=") {
            expected_sig = Some(v);
        }
    }

    let (Some(timestamp), Some(expected)) = (timestamp_str, expected_sig) else {
        return false;
    };

    let signed_payload = format!("{}.{}", timestamp, String::from_utf8_lossy(payload));

    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(signed_payload.as_bytes());
    let computed = hex::encode(mac.finalize().into_bytes());

    computed == expected
}
