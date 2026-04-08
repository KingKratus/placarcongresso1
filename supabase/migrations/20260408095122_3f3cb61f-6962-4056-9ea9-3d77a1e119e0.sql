-- Drop the insecure has_role(uuid, app_role) overload that allows role probing
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Add missing INSERT policy on profiles table
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);