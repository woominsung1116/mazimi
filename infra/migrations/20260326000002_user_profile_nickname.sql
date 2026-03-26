-- Add nickname and profile_image_url to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
