-- SQL Schema for NutriScan AI

-- 1. Create the Food_Analysis table
CREATE TABLE IF NOT EXISTS public.food_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    detected_foods JSONB NOT NULL,
    calories FLOAT DEFAULT 0,
    protein FLOAT DEFAULT 0,
    fats FLOAT DEFAULT 0,
    carbs FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.food_analysis ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
-- Allow users to view only their own analysis
CREATE POLICY "Users can view their own food analysis" 
ON public.food_analysis FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own analysis
CREATE POLICY "Users can insert their own food analysis" 
ON public.food_analysis FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Storage Setup (Run these in the Supabase Dashboard)
-- Create a bucket named 'food-images'
-- Set bucket to public or use signed URLs
-- Add policy for authenticated users to upload to 'food-images'
