const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ORDER_CODE_RE = /AIM[A-Z0-9]{6,16}/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const authHeader = req.headers['authorization'] || '';
  const expected = `Apikey ${process.env.SEPAY_WEBHOOK_APIKEY || ''}`;
  if (!process.env.SEPAY_WEBHOOK_APIKEY || authHeader !== expected) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const payload = req.body || {};

  if (payload.transferType !== 'in') {
    return res.status(200).json({ success: true, ignored: true, reason: 'not_incoming' });
  }

  const haystack = `${payload.content || ''} ${payload.code || ''}`.toUpperCase();
  const match = haystack.match(ORDER_CODE_RE);
  if (!match) {
    return res.status(200).json({ success: true, ignored: true, reason: 'no_order_code_found' });
  }

  const orderCode = match[0];

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('code', orderCode)
    .maybeSingle();

  if (fetchError || !order) {
    return res.status(200).json({ success: true, ignored: true, reason: 'order_not_found' });
  }

  if (order.status === 'paid') {
    return res.status(200).json({ success: true, already_paid: true });
  }

  const transferAmount = Number(payload.transferAmount || 0);
  if (transferAmount < order.amount) {
    return res.status(200).json({ success: true, ignored: true, reason: 'amount_mismatch' });
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      reference_code: payload.referenceCode || null,
      received_amount: transferAmount,
    })
    .eq('code', orderCode);

  if (updateError) {
    return res.status(500).json({ success: false, error: 'update_failed' });
  }

  return res.status(200).json({ success: true });
};
