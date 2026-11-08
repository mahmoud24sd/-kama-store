# اختبارات قاعدة البيانات (محلية، اختيارية)

تشغّل `schema.sql` على Postgres عادي باستخدام بدائل بسيطة لمخططي `auth` و`storage` في Supabase،
ثم تختبر RLS وحساب الطلب والمخزون والكوبون والإلغاء. **لا تشغّلها على مشروع Supabase حقيقي.**

```bash
createdb shop_test
psql -d shop_test -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql
psql -d shop_test -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql -d shop_test -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql -d shop_test -v ON_ERROR_STOP=1 -f supabase/seed_demo.sql   # الاختبارات تعتمد على المنتجات التجريبية
psql -d shop_test -f supabase/tests/10_behavior_tests.sql        # آخر مخرجات: passed / failed
```

حدودها: البدائل ليست نظام Supabase الحقيقي (دالة `auth.uid()` مبسّطة، وسياسات Storage لا تُختبر).
