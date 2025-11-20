const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const API_URL = 'https://surveys.aphrc.org/redcap/api/';

    try {
        console.log("🔔 REDCap DET Trigger Received");

        let body;
        if (typeof event.body === 'string') {
            try {
                body = JSON.parse(event.body);
            } catch {
                const params = new URLSearchParams(event.body);
                body = Object.fromEntries(params);
            }
        } else {
            body = event.body || {};
        }

        console.log("Parsed body:", body);

        const recordId = body.record || body.record_id;
        if (!recordId) {
            return { statusCode: 200, body: "No record ID provided" };
        }

        // Fetch full record from REDCap API
        const apiResponse = await fetch(API_URL, {
            method: "POST",
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                token: '41511809027787BF40860383A25B03CE',
                content: "record",
                format: "json",
                type: "flat",
                records: recordId,
            }),
        });

        const data = await apiResponse.json();
        console.log("📌 Updated record from REDCap:", data);

        // Save to Supabase
        const record = data[0] || data;
        const { error } = await supabase
            .from('redcap_records')
            .insert({
                record_id: recordId,
                instrument: body.instrument,
                data: record
            });

        if (error) {
            console.error("Supabase error:", error);
        } else {
            console.log("✅ Saved to Supabase!");
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, record: data }),
        };

    } catch (error) {
        console.error("❌ ERROR:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};