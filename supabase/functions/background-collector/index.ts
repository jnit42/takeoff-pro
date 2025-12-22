/**
 * Background Data Collector
 * QUARANTINED: Web scraping disabled for security and reliability
 * This function is now a no-op placeholder
 * 
 * Pricing data should come from:
 * 1. User's price book entries
 * 2. Manual imports from trusted vendor quotes
 * 3. Future: Direct vendor API integrations
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[background-collector] Function called but web scraping is disabled');

  // Return informative message about the quarantine
  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'Background web scraping has been disabled for security and reliability.',
      recommendation: 'Use the price book feature to manage your material costs.',
      alternatives: [
        'Add items to your price book manually',
        'Import quotes from vendors as receipts',
        'Update prices when you get current quotes'
      ]
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
