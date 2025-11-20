const { getStore } = require('@netlify/blobs');

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

        // Store in Netlify Blobs
        const store = getStore('redcap-records');

        // Get existing records
        let existingRecords = [];
        try {
            const storedData = await store.get('records');
            if (storedData) {
                existingRecords = JSON.parse(storedData);
            }
        } catch (e) {
            console.log("No existing records found");
        }

        // Add new record(s)
        existingRecords.push(...data);

        // Keep only last 100 records to avoid bloating
        if (existingRecords.length > 100) {
            existingRecords = existingRecords.slice(-100);
        }

        // Save back to store
        await store.set('records', JSON.stringify(existingRecords));

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, record: data }),
        };

    } catch (error) {
        console.error("❌ ERROR:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};