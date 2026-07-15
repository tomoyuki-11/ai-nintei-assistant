use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

// ─── Organizations ────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow, Clone)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub system_prompt: String,
    pub plan: String,
    pub license_expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub license_key: String,
    pub created_at: DateTime<Utc>,
    pub transcription_save_mode: String,
    pub formatted_save_mode: String,
    pub subscription_cancel_at: Option<DateTime<Utc>>,
    pub stripe_subscription_id: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct OrgSettings {
    pub transcription_save_mode: String,
    pub formatted_save_mode: String,
}

pub async fn create_organization(
    pool: &PgPool,
    name: &str,
    system_prompt: &str,
    plan: &str,
    license_expires_at: Option<DateTime<Utc>>,
) -> Result<Uuid, sqlx::Error> {
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO organizations (name, system_prompt, plan, license_expires_at, license_key)
         VALUES ($1, $2, $3, $4, gen_random_uuid()::text) RETURNING id",
    )
    .bind(name)
    .bind(system_prompt)
    .bind(plan)
    .bind(license_expires_at)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn find_org_by_license_key(
    pool: &PgPool,
    key: &str,
) -> Result<Option<Organization>, sqlx::Error> {
    sqlx::query_as::<_, Organization>(
        "SELECT id, name, system_prompt, plan, license_expires_at, is_active, license_key, created_at, transcription_save_mode, formatted_save_mode
         FROM organizations WHERE license_key = $1",
    )
    .bind(key)
    .fetch_optional(pool)
    .await
}

pub async fn get_organization(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<Organization>, sqlx::Error> {
    sqlx::query_as::<_, Organization>(
        "SELECT id, name, system_prompt, plan, license_expires_at, is_active, license_key, created_at, transcription_save_mode, formatted_save_mode, subscription_cancel_at, stripe_subscription_id
         FROM organizations WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_all_organizations(pool: &PgPool) -> Result<Vec<Organization>, sqlx::Error> {
    sqlx::query_as::<_, Organization>(
        "SELECT id, name, system_prompt, plan, license_expires_at, is_active, license_key, created_at, transcription_save_mode, formatted_save_mode, subscription_cancel_at, stripe_subscription_id
         FROM organizations
         WHERE id NOT IN (
             SELECT organization_id FROM users WHERE role = 'individual'
         )
         ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn update_organization(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    system_prompt: &str,
    plan: &str,
    license_expires_at: Option<DateTime<Utc>>,
    is_active: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organizations
         SET name = $1, system_prompt = $2, plan = $3, license_expires_at = $4, is_active = $5
         WHERE id = $6",
    )
    .bind(name)
    .bind(system_prompt)
    .bind(plan)
    .bind(license_expires_at)
    .bind(is_active)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_org_settings(pool: &PgPool, org_id: Uuid) -> Result<Option<OrgSettings>, sqlx::Error> {
    sqlx::query_as::<_, OrgSettings>(
        "SELECT transcription_save_mode, formatted_save_mode FROM organizations WHERE id = $1",
    )
    .bind(org_id)
    .fetch_optional(pool)
    .await
}

pub async fn update_org_settings(
    pool: &PgPool,
    org_id: Uuid,
    transcription_save_mode: &str,
    formatted_save_mode: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organizations SET transcription_save_mode = $1, formatted_save_mode = $2 WHERE id = $3",
    )
    .bind(transcription_save_mode)
    .bind(formatted_save_mode)
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_organization(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM organizations WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ─── Users ────────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub password_hash: String,
    pub role: String,
    pub name: String,
}

pub async fn create_user(
    pool: &PgPool,
    org_id: Uuid,
    email: &str,
    password_hash: &str,
    role: &str,
    name: &str,
) -> Result<Uuid, sqlx::Error> {
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO users (organization_id, email, password_hash, role, name)
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(org_id)
    .bind(email)
    .bind(password_hash)
    .bind(role)
    .bind(name)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

#[derive(Serialize, sqlx::FromRow)]
pub struct UserInfo {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

pub async fn list_users_by_org(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Vec<UserInfo>, sqlx::Error> {
    sqlx::query_as::<_, UserInfo>(
        "SELECT id, email, role, name, created_at FROM users WHERE organization_id = $1 ORDER BY created_at ASC",
    )
    .bind(org_id)
    .fetch_all(pool)
    .await
}

pub async fn delete_user(
    pool: &PgPool,
    user_id: Uuid,
    org_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM users WHERE id = $1 AND organization_id = $2")
        .bind(user_id)
        .bind(org_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn find_user_by_login_in_org(
    pool: &PgPool,
    login_id: &str,
    org_id: Uuid,
) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>(
        "SELECT id, organization_id, password_hash, role, name
         FROM users WHERE email = $1 AND organization_id = $2",
    )
    .bind(login_id)
    .bind(org_id)
    .fetch_optional(pool)
    .await
}

// ─── Transcriptions ───────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Transcription {
    pub id: Uuid,
    pub text: Option<String>,
    pub formatted: Option<String>,
    pub user_name: String,
    pub created_at: DateTime<Utc>,
    pub audio_path: Option<String>,
}

pub async fn save_text_only(
    pool: &PgPool,
    text: &str,
    org_id: Uuid,
    user_name: &str,
    audio_path: Option<&str>,
) -> Result<Uuid, sqlx::Error> {
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO transcriptions (text, organization_id, user_name, audio_path) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(text)
    .bind(org_id)
    .bind(user_name)
    .bind(audio_path)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn save_transcription(
    pool: &PgPool,
    text: &str,
    formatted: &str,
    org_id: Uuid,
    user_name: &str,
    audio_path: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO transcriptions (text, formatted, organization_id, user_name, audio_path) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(text)
    .bind(formatted)
    .bind(org_id)
    .bind(user_name)
    .bind(audio_path)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn save_formatted_only(
    pool: &PgPool,
    formatted: &str,
    org_id: Uuid,
    user_name: &str,
    audio_path: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO transcriptions (text, formatted, organization_id, user_name, audio_path) VALUES (NULL, $1, $2, $3, $4)",
    )
    .bind(formatted)
    .bind(org_id)
    .bind(user_name)
    .bind(audio_path)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_formatted(
    pool: &PgPool,
    id: Uuid,
    formatted: &str,
    org_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE transcriptions SET formatted = $1 WHERE id = $2 AND organization_id = $3",
    )
    .bind(formatted)
    .bind(id)
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_text(
    pool: &PgPool,
    id: Uuid,
    text: &str,
    org_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE transcriptions SET text = $1 WHERE id = $2 AND organization_id = $3",
    )
    .bind(text)
    .bind(id)
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn clear_text(pool: &PgPool, id: Uuid, org_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE transcriptions SET text = NULL WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn clear_formatted(pool: &PgPool, id: Uuid, org_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE transcriptions SET formatted = NULL WHERE id = $1 AND organization_id = $2")
        .bind(id)
        .bind(org_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_transcription(
    pool: &PgPool,
    id: Uuid,
    org_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "DELETE FROM transcriptions WHERE id = $1 AND organization_id = $2 RETURNING audio_path",
    )
    .bind(id)
    .bind(org_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|(p,)| p))
}

pub async fn get_audio_path(
    pool: &PgPool,
    id: Uuid,
    org_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT audio_path FROM transcriptions WHERE id = $1 AND organization_id = $2",
    )
    .bind(id)
    .bind(org_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|(p,)| p))
}

// ─── Usage counts ─────────────────────────────────────────────────────────────

pub async fn get_monthly_usage(pool: &PgPool, org_id: Uuid, year_month: &str) -> Result<i32, sqlx::Error> {
    let row: Option<(i32,)> = sqlx::query_as(
        "SELECT count FROM usage_counts WHERE organization_id = $1 AND year_month = $2",
    )
    .bind(org_id)
    .bind(year_month)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| r.0).unwrap_or(0))
}

pub async fn increment_usage(pool: &PgPool, org_id: Uuid, year_month: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO usage_counts (organization_id, year_month, count) VALUES ($1, $2, 1)
         ON CONFLICT (organization_id, year_month) DO UPDATE SET count = usage_counts.count + 1",
    )
    .bind(org_id)
    .bind(year_month)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_org_credits(pool: &PgPool, org_id: Uuid) -> Result<i32, sqlx::Error> {
    let row: Option<(i32,)> = sqlx::query_as(
        "SELECT metered_credits FROM organizations WHERE id = $1",
    )
    .bind(org_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| r.0).unwrap_or(0))
}

pub async fn add_credits(pool: &PgPool, org_id: Uuid, amount: i32) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organizations
         SET metered_credits = metered_credits + $1,
             plan = CASE WHEN plan = 'trial' THEN 'metered' ELSE plan END
         WHERE id = $2",
    )
    .bind(amount)
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn deduct_credit(pool: &PgPool, org_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE organizations SET metered_credits = metered_credits - 1 WHERE id = $1 AND metered_credits > 0",
    )
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn upgrade_org_to_monthly(
    pool: &PgPool,
    org_id: Uuid,
    stripe_customer_id: &str,
    stripe_subscription_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organizations SET plan = 'monthly', stripe_customer_id = $1, stripe_subscription_id = $2 WHERE id = $3",
    )
    .bind(stripe_customer_id)
    .bind(stripe_subscription_id)
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn reset_monthly_usage(pool: &PgPool, org_id: Uuid, year_month: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM usage_counts WHERE organization_id = $1 AND year_month = $2",
    )
    .bind(org_id)
    .bind(year_month)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_stripe_customer_id(pool: &PgPool, org_id: Uuid) -> Result<Option<String>, sqlx::Error> {
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT stripe_customer_id FROM organizations WHERE id = $1",
    )
    .bind(org_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|(v,)| v))
}

pub async fn set_subscription_cancel_at(
    pool: &PgPool,
    stripe_customer_id: &str,
    cancel_at: Option<DateTime<Utc>>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organizations SET subscription_cancel_at = $1 WHERE stripe_customer_id = $2",
    )
    .bind(cancel_at)
    .bind(stripe_customer_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn revert_org_plan_by_customer(pool: &PgPool, stripe_customer_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organizations
         SET plan = 'metered', stripe_subscription_id = NULL, subscription_cancel_at = NULL
         WHERE stripe_customer_id = $1",
    )
    .bind(stripe_customer_id)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
pub struct IndividualUser {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub password_hash: String,
    pub role: String,
    pub name: String,
    pub is_first_login: bool,
}

pub async fn find_individual_user_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<IndividualUser>, sqlx::Error> {
    sqlx::query_as::<_, IndividualUser>(
        "SELECT id, organization_id, password_hash, role, name, is_first_login
         FROM users WHERE email = $1 AND role = 'individual'",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

pub async fn get_user_password_hash(pool: &PgPool, user_id: Uuid) -> Result<Option<String>, sqlx::Error> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT password_hash FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(h,)| h))
}

pub async fn update_user_password(pool: &PgPool, user_id: Uuid, new_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(new_hash)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn complete_individual_onboarding(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE users SET is_first_login = false WHERE id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn create_individual_user(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
) -> Result<(Uuid, Uuid), sqlx::Error> {
    let expires_at = chrono::Utc::now() + chrono::Duration::days(14);
    let org_row: (Uuid,) = sqlx::query_as(
        "INSERT INTO organizations (name, system_prompt, plan, license_expires_at, license_key)
         VALUES ($1, '', 'trial', $2, gen_random_uuid()::text) RETURNING id",
    )
    .bind(email)
    .bind(expires_at)
    .fetch_one(pool)
    .await?;
    let org_id = org_row.0;

    let user_row: (Uuid,) = sqlx::query_as(
        "INSERT INTO users (organization_id, email, password_hash, role, name, is_first_login)
         VALUES ($1, $2, $3, 'individual', $2, true) RETURNING id",
    )
    .bind(org_id)
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await?;

    Ok((user_row.0, org_id))
}

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct IndividualUserAdmin {
    pub id: Uuid,
    pub email: String,
    pub plan: String,
    pub credits: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub license_expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn list_individual_users(pool: &PgPool) -> Result<Vec<IndividualUserAdmin>, sqlx::Error> {
    sqlx::query_as::<_, IndividualUserAdmin>(
        "SELECT u.id, u.email, o.plan, COALESCE(o.metered_credits, 0) as credits,
                u.created_at, o.license_expires_at
         FROM users u
         JOIN organizations o ON o.id = u.organization_id
         WHERE u.role = 'individual'
         ORDER BY u.created_at DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn add_credits_for_individual_user(pool: &PgPool, user_id: Uuid, amount: i32) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organizations SET metered_credits = metered_credits + $1
         WHERE id = (SELECT organization_id FROM users WHERE id = $2 AND role = 'individual')",
    )
    .bind(amount)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_plan_for_individual_user(pool: &PgPool, user_id: Uuid, plan: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE organizations SET plan = $1
         WHERE id = (SELECT organization_id FROM users WHERE id = $2 AND role = 'individual')",
    )
    .bind(plan)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_transcriptions(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Vec<Transcription>, sqlx::Error> {
    sqlx::query_as::<_, Transcription>(
        "SELECT id, text, formatted, user_name, created_at, audio_path
         FROM transcriptions
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT 50",
    )
    .bind(org_id)
    .fetch_all(pool)
    .await
}

pub async fn mark_excel_downloaded(
    pool: &PgPool,
    id: Uuid,
    org_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE transcriptions SET excel_downloaded_at = NOW() WHERE id = $1 AND organization_id = $2",
    )
    .bind(id)
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_excel_expired_records(pool: &PgPool) -> Result<(u64, Vec<String>), sqlx::Error> {
    let rows: Vec<(Option<String>,)> = sqlx::query_as(
        "DELETE FROM transcriptions
         WHERE formatted IS NOT NULL
           AND created_at < NOW() - INTERVAL '5 days'
         RETURNING audio_path",
    )
    .fetch_all(pool)
    .await?;
    let count = rows.len() as u64;
    let audio_paths: Vec<String> = rows.into_iter().filter_map(|(p,)| p).collect();
    Ok((count, audio_paths))
}
