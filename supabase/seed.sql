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

-- Response/reply times so Overview stats have data.
update leads set first_response_at = created_at + interval '8 seconds' where status <> 'new';
update leads set last_reply_at = created_at + interval '2 hours' where status in ('replied', 'meeting_booked', 'won');

-- Outbound messages with mixed delivery states.
insert into messages (lead_id, channel, direction, template_name, body, provider_message_id, status, created_at)
select id, 'whatsapp', 'out', 'welcome_samples', 'Hi there, thanks for your interest in AI video ads!',
       'wamid.seed_' || leadgen_id, (array['sent','delivered','read'])[1 + (abs(hashtext(leadgen_id)) % 3)]::msg_status,
       created_at + interval '8 seconds'
from leads where status <> 'new';

insert into messages (lead_id, channel, direction, template_name, body, provider_message_id, status, created_at)
select id, 'email', 'out', 'welcome', 'AI video ads for ' || brand_name, 'email_seed_' || leadgen_id, 'sent',
       created_at + interval '9 seconds'
from leads where status <> 'new';

insert into messages (lead_id, channel, direction, body, provider_message_id, status, created_at)
select id, 'whatsapp', 'in', 'Hi, interested. Can we talk tomorrow?', 'wamid.seed_in_' || leadgen_id, 'received', last_reply_at
from leads where status = 'replied';

-- Pending follow-ups for contacted leads, a dead job to retry, a recent webhook, a duplicate.
insert into jobs (lead_id, type, payload, status, run_at, idempotency_key)
select id, 'followup', '{"step":"day2","template":"followup_case_study"}', 'pending', now() + interval '1 day',
       'followup:day2:' || id
from leads where status = 'contacted';

insert into jobs (lead_id, type, payload, status, attempts, last_error, idempotency_key)
select id, 'send_whatsapp', '{"template":"welcome_samples"}', 'dead', 3,
       'whatsapp send failed: HTTP 400 code 131026 Message undeliverable', 'send_whatsapp:welcome:seed-dead'
from leads where leadgen_id = 'test_7';

insert into events (type, payload, created_at) values ('webhook.meta', '{"object":"page","entry":[]}', now() - interval '1 hour');

insert into leads (leadgen_id, full_name, phone_e164, phone_valid, email, brand_name, category, budget_range,
  budget_min_inr, start_timeline, score, score_source, status, duplicate_of, campaign_name, created_at)
select 'test_dup', full_name, phone_e164, true, email, brand_name, category, budget_range, budget_min_inr,
  start_timeline, score, 'rules', 'new', id, campaign_name, now() - interval '2 hours'
from leads where leadgen_id = 'test_2';
