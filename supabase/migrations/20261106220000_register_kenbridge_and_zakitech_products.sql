-- Register the complete Zakmolanitech Solutions product portfolio.
INSERT INTO public.zt_products
  (slug, name, description, repository_url, website_url, admin_center_url, status, deployment_url)
VALUES
  ('kenbridge-christian-school','Kenbridge Christian School','Official website designed and developed by Zakmolanitech Solutions for Kenbridge Christian Schools. Presents the school identity, story, leadership, admissions information and contact channels.',NULL,'https://kenbridgeducation.app/',NULL,'launched','https://kenbridgeducation.app/'),
  ('zakitech-app','ZakiTech','Zakmolanitech Solutions’ company application and secure operations workspace, connecting staff, product development, assignments, releases, support and the company Product Hub.','https://github.com/zakpollyqueens/Zakitech','https://zakpollyqueens.github.io/Zakitech/','https://zakpollyqueens.github.io/Zakitech/workspace.html','launched','https://zakpollyqueens.github.io/Zakitech/')
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, repository_url=EXCLUDED.repository_url,
  website_url=EXCLUDED.website_url, admin_center_url=EXCLUDED.admin_center_url,
  status=EXCLUDED.status, deployment_url=EXCLUDED.deployment_url, updated_at=now();