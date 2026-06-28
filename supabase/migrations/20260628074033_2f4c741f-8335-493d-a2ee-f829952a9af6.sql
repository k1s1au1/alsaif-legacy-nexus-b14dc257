DROP POLICY IF EXISTS "Only admins/chairman manage section heads" ON public.section_heads;
CREATE POLICY "Only chairman manages section heads"
ON public.section_heads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'chairman'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'chairman'::app_role) OR has_role(auth.uid(), 'admin'::app_role));