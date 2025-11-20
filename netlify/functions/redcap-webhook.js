// In-memory storage
let recordsMemory = [];

exports.handler = async (event, context) => {
    const API_URL = 'https://surveys.aphrc.org/redcap/api/';

    try {
        // Parse the incoming body
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

        console.log("🔔 Parsed body:", body);

        const recordId = body.record || body.record_id;
        if (!recordId) {
            return { statusCode: 200, body: "No record ID provided" };
        }

        // Fetch full record from REDCap API
        const apiResponse = await fetch(API_URL, {
            method: "POST",
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                token: '41511809027787BF40860383A25B03CE', // replace with your token
                content: "record",
                format: "json",
                type: "flat",
                records: recordId,
            }),
        });

        const data = await apiResponse.json();
        console.log("📌 Updated record from REDCap:", data);

        // Save record in memory
        recordsMemory.push(...data);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, record: data }),
        };

    } catch (error) {
        console.error("❌ ERROR:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

// Expose records for retrieval
exports.getRecords = () => recordsMemory;


