with parsed_salaries as (
  select
    id,
    regexp_match(
      description,
      '\$[[:space:]]*([0-9][0-9,]*)(?:[[:space:]]*(?:-|–|—|to)[[:space:]]*\$?[[:space:]]*([0-9][0-9,]*))?[[:space:]]*(?:a|per)?[[:space:]]*(?:year|yr)',
      'i'
    ) as salary_match
  from public.job_leads
  where salary_min is null
    and description like '%$%'
)
update public.job_leads as leads
set
  salary_min = replace(parsed.salary_match[1], ',', '')::numeric,
  salary_max = case
    when parsed.salary_match[2] is null then null
    else replace(parsed.salary_match[2], ',', '')::numeric
  end
from parsed_salaries as parsed
where leads.id = parsed.id
  and parsed.salary_match is not null;
