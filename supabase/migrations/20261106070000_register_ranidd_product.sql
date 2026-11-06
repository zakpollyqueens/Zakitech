insert into public.zt_products
(slug,name,description,repository_url,website_url,admin_center_url,current_version,status)
values
('ranidd-online-mart','Ranidd Online Mart','E-commerce marketplace designed and built by Zakmolanitech Solutions. Managed from the ZakiTech Product Hub with owner-only product oversight, release coordination, team tasks and audited operational commands.','https://github.com/zakpollyqueens/Ranidd-Online-Shopping','https://ranidd-online-shopping.zakpollyqueens.workers.dev','https://zakpollyqueens.github.io/Zakitech/product-super-admin.html?product=ranidd-online-mart',null,'in_development')
on conflict (slug) do update set
 name=excluded.name,
 description=excluded.description,
 repository_url=excluded.repository_url,
 website_url=excluded.website_url,
 admin_center_url=excluded.admin_center_url,
 updated_at=now();
