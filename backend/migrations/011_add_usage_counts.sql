CREATE TABLE usage_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(organization_id, year_month)
);
