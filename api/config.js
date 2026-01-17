export default function handler(request, response) {
  response.status(200).json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
  });
}
