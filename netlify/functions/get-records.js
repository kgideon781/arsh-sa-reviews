const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async () => {
    try {
        const { data, error } = await supabase
            .from('redcap_records')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data || []),
        };
    } catch (error) {
        console.error('Error fetching records:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};