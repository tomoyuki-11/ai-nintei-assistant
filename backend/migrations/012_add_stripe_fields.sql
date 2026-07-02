ALTER TABLE organizations
    ADD COLUMN stripe_customer_id VARCHAR,
    ADD COLUMN stripe_subscription_id VARCHAR;
