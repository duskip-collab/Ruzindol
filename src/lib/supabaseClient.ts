import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dblpurtsxynxacmzyiyw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRibHB1cnRzeHlueGFjbXp5aXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTA2NjksImV4cCI6MjA5ODk2NjY2OX0.RcYY2G684szZ-CfJSih1cV5pk4ZdqbaVpaa3lbk1Hck';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);