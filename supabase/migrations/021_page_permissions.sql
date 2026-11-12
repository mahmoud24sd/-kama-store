-- صلاحيات صفحات المسودات / المنشور / المهملات: الأدمن اللي معاه «المنتجات» بالفعل يفضل يوصلهم.
-- الحذف النهائي (trash_purge) ما بيتدّاش لحد، المالك بيدّيه من «الفريق والصلاحيات».
update public.profiles
set permissions = (
  select array(select distinct unnest(permissions || array['drafts', 'published', 'trash']))
)
where role = 'admin' and 'products' = any (permissions);
