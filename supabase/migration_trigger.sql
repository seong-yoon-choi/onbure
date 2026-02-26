-- 1. Create a trigger function to sync auth.users with public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, username, gender, age, country, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    case
      when lower(coalesce(new.raw_user_meta_data->>'gender', '')) in ('male', 'female', 'other')
        then lower(new.raw_user_meta_data->>'gender')
      else null
    end,
    case
      when coalesce(new.raw_user_meta_data->>'age', '') ~ '^[0-9]{1,3}$'
        and (new.raw_user_meta_data->>'age')::integer between 1 and 120
        then (new.raw_user_meta_data->>'age')::integer
      else null
    end,
    nullif(upper(coalesce(new.raw_user_meta_data->>'country', '')), ''),
    now(),
    now()
  )
  on conflict (user_id) do update
    set email = excluded.email,
        username = excluded.username,
        gender = excluded.gender,
        age = excluded.age,
        country = excluded.country,
        updated_at = now();

  return new;
end;
$$;

-- 2. Attach the trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
