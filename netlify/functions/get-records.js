const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
    try {
        const store = getStore('redcap-records');
        const storedData = await store.get('records');

        const records = storedData ? JSON.parse(storedData) : [];

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(records),
        };
    } catch (error) {
        console.error('Error fetching records:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};