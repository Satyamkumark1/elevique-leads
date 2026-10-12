-- Local/dev only. Never run against production (`supabase db push` does not run seeds).

update settings set value = '["you@elevique.in", "team@elevique.test"]' where key = 'allowed_emails';

update settings set value = '{
  "showreel_url": "https://elevique.in/showreel",
  "starting_price_line": "Dev seed: replace with your real starting price line.",
  "case_studies": [
    {"title": "Dev case study 1", "url": "https://elevique.in/work/1"},
    {"title": "Dev case study 2", "url": "https://elevique.in/work/2"},
    {"title": "Dev case study 3", "url": "https://elevique.in/work/3"}
  ]
}' where key = 'email_content';

insert into sample_reels (category, title, url, sort) values
  ('Fashion',                'Fashion reel',      'https://elevique.in/samples/fashion',  0),
  ('Beauty & personal care', 'Beauty reel',       'https://elevique.in/samples/beauty',   0),
  ('Food & beverage',        'Food reel',         'https://elevique.in/samples/food',     0),
  ('Electronics',            'Electronics reel',  'https://elevique.in/samples/electronics', 0),
  ('Home & living',          'Home reel',         'https://elevique.in/samples/home',     0),
  ('Other',                  'Showreel',          'https://elevique.in/samples/showreel', 0);

insert into leads (
  leadgen_id, full_name, phone_e164, phone_valid, email, brand_name, brand_link, category,
  budget_range, budget_min_inr, videos_per_month, start_timeline,
  campaign_id, campaign_name, ad_id, ad_name, form_id,
  score, score_source, ai_summary, ai_status, status, meta_created_at, created_at
)
select
  'test_' || i,
  'Test Lead ' || i,
  '+9190000' || lpad(i::text, 5, '0'),
  true,
  'lead' || i || '@example.com',
  'Brand ' || i,
  case when i % 3 = 0 then null else 'https://instagram.com/brand' || i end,
  (array['Fashion','Beauty & personal care','Food & beverage','Electronics','Home & living','Other'])[1 + i % 6],
  (array['Under ₹25k','₹25k–50k','₹50k–1L','₹1L–2L','₹2L+'])[1 + i % 5],
  (array[0, 25000, 50000, 100000, 200000])[1 + i % 5],
  (array['1–2','3–5','6–10','10+'])[1 + i % 4],
  (array['This week','This month','In 1–3 months','Just exploring'])[1 + i % 4],
  'cmp_' || (1 + i % 3),
  (array['Diwali Fashion','Beauty Reels','D2C Generic'])[1 + i % 3],
  'ad_' || (1 + i % 5),
  'Ad ' || (1 + i % 5),
  'form_1',
  (array['hot','warm','cold'])[1 + i % 3]::lead_score,
  'rules',
  'Seeded test lead ' || i,
  'done',
  (array['new','contacted','replied','meeting_booked','won','lost','opted_out'])[1 + i % 7]::lead_status,
  now() - i * interval '18 hours',
  now() - i * interval '18 hours'
from generate_series(1, 40) i;

insert into events (lead_id, type, description, created_at)
select id, 'lead.created', 'Lead received from Meta form', created_at from leads;
