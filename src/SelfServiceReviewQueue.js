import React, { useState } from 'react';
import { Search, FileText, ExternalLink, Loader2, Mail, CheckCircle, AlertCircle, ClipboardList } from 'lucide-react';

export default function SelfServiceReviewQueue() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [reviewerData, setReviewerData] = useState(null);
    const [surveyLinks, setSurveyLinks] = useState([]);
    const [surveyQueueUrl, setSurveyQueueUrl] = useState(null);
    const [loadingSurveyUrl, setLoadingSurveyUrl] = useState(false);
    const [debugData, setDebugData] = useState(null); // For debugging

    const API_URL = 'https://surveys.aphrc.org/redcap/api/';
    const API_TOKEN = '61D8A52BF9C6221AE9201EB9272C82A1'; // TODO: UPDATE TO PID 159 TOKEN!

    // Fetch survey participant information to get survey queue link
    const fetchSurveyQueueLink = async (recordId, email) => {
        setLoadingSurveyUrl(true);
        try {
            // Method 1: Try to get survey participant info
            const formBody = new URLSearchParams({
                token: API_TOKEN,
                content: 'participantList',
                format: 'json',
                instrument: 'marking_sheet',
                event: '',
                returnFormat: 'json'
            });

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formBody.toString()
            });

            if (response.ok) {
                const data = await response.json();

                // Find participant by email or record_id
                const participant = data.find(p =>
                    p.email === email ||
                    p.record === recordId ||
                    p.record_id === recordId
                );

                if (participant && participant.survey_queue_link) {
                    setSurveyQueueUrl(participant.survey_queue_link);
                    return participant.survey_queue_link;
                }

                if (participant && participant.survey_link) {
                    setSurveyQueueUrl(participant.survey_link);
                    return participant.survey_link;
                }
            }

            // Method 2: Try surveyLink API
            const linkBody = new URLSearchParams({
                token: API_TOKEN,
                content: 'surveyLink',
                record: recordId,
                instrument: 'marking_sheet',
                event: '',
                returnFormat: 'json'
            });

            const linkResponse = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: linkBody.toString()
            });

            if (linkResponse.ok) {
                const linkData = await linkResponse.text();
                if (linkData && linkData.startsWith('http')) {
                    setSurveyQueueUrl(linkData);
                    return linkData;
                }
            }

            // Method 3: Construct generic survey queue URL
            // Format: https://surveys.aphrc.org/redcap/surveys/?sq=[hash]
            // We'll use a simpler approach - direct link to the first survey
            const directLink = `https://surveys.aphrc.org/redcap/surveys/?s=${btoa(recordId + 'marking_sheet')}`;
            console.log('Using constructed link:', directLink);

            return null; // Let it fall back to manual options

        } catch (err) {
            console.error('Error fetching survey queue link:', err);
            return null;
        } finally {
            setLoadingSurveyUrl(false);
        }
    };

    const fetchReviewerInfo = async () => {
        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);
        setError('');
        setReviewerData(null);
        setSurveyLinks([]);

        try {
            // Fetch reviewer details
            const formBody = new URLSearchParams({
                token: API_TOKEN,
                content: 'record',
                format: 'json',
                type: 'flat',
                forms: 'reviewer_details',
                filterLogic: `[rev_email]="${email}"`,
                returnFormat: 'json'
            });

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formBody.toString()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (data && data.length > 0) {
                const reviewer = data[0];
                setReviewerData(reviewer);

                // Parse assigned proposals
                const proposals = reviewer.assigned_proposals
                    ? reviewer.assigned_proposals.split(',').map(p => p.trim()).filter(p => p)
                    : [];

                // Fetch existing reviews to see what's completed
                const reviewsBody = new URLSearchParams({
                    token: API_TOKEN,
                    content: 'record',
                    format: 'json',
                    type: 'flat',
                    records: reviewer.record_id,
                    forms: 'marking_sheet',
                    returnFormat: 'json'
                });

                const reviewsResponse = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: reviewsBody.toString()
                });

                const reviewsData = await reviewsResponse.json();

                console.log('=== REDCap Reviews Raw Response ===');
                console.log('Total records returned:', reviewsData.length);
                console.log('Full response:', JSON.stringify(reviewsData, null, 2));

                // The response might not have redcap_repeat_instrument if REDCap returns it differently
                // Check if we have candidate_names field - that indicates it's a review
                // IMPORTANT: Only count as completed if marking_sheet_complete is '2' (Complete)
                const reviewedCandidates = reviewsData
                    .filter(r => {
                        // A record is a review if it has candidate_names filled
                        const hasCandidate = r.candidate_names && r.candidate_names.trim() !== '';

                        // Additional check: it should be from marking_sheet form
                        // If redcap_repeat_instrument exists, use it; otherwise rely on candidate_names
                        const isMarkingSheet = !r.redcap_repeat_instrument || r.redcap_repeat_instrument === 'marking_sheet';

                        // CRITICAL: Only include if form is marked as Complete (2)
                        const isComplete = r.marking_sheet_complete === '2';

                        console.log('Checking record for review:', {
                            has_redcap_repeat_instrument: !!r.redcap_repeat_instrument,
                            redcap_repeat_instrument: r.redcap_repeat_instrument,
                            redcap_repeat_instance: r.redcap_repeat_instance,
                            candidate_names: r.candidate_names,
                            marking_sheet_complete: r.marking_sheet_complete,
                            hasCandidate,
                            isMarkingSheet,
                            isComplete,
                            willInclude: hasCandidate && isMarkingSheet && isComplete
                        });

                        return hasCandidate && isMarkingSheet && isComplete;
                    })
                    .map(r => r.candidate_names.trim());

                console.log('Filtered reviewed candidates:', reviewedCandidates);
                console.log('===========================');

                // Store debug data
                setDebugData({
                    totalRecords: reviewsData.length,
                    fullResponse: reviewsData,
                    proposals: proposals,
                    reviewedCandidates: reviewedCandidates,
                    detailedReviews: reviewsData
                        .filter(r => r.candidate_names && r.candidate_names.trim() !== '')
                        .map(r => ({
                            candidate_names: r.candidate_names,
                            instance: r.redcap_repeat_instance || 'N/A',
                            complete: r.marking_sheet_complete || 'N/A',
                            has_repeat_fields: !!r.redcap_repeat_instrument,
                            isCompleted: r.marking_sheet_complete === '2'
                        }))
                });

                // Create survey links for each proposal
                const links = proposals.map(proposalName => {
                    const isCompleted = reviewedCandidates.includes(proposalName);
                    console.log(`Checking "${proposalName}": Completed = ${isCompleted}`);

                    return {
                        candidateName: proposalName,
                        completed: isCompleted
                    };
                });

                setSurveyLinks(links);

                // Fetch the survey queue link
                await fetchSurveyQueueLink(reviewer.record_id, reviewer.rev_email);
            } else {
                setError('No reviewer found with this email address. Please check and try again.');
            }
        } catch (err) {
            setError(`Failed to fetch reviewer information: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            fetchReviewerInfo();
        }
    };

    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: '#7bc148' }}>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-4 border-white mb-6">
                    <div className="p-8 text-white" style={{ backgroundColor: '#7bc148' }}>
                        <h1 className="text-3xl font-bold mb-2">My Review Queue</h1>
                        <p className="text-green-50">Access your assigned proposal reviews</p>
                    </div>

                    {/* Email Input */}
                    <div className="p-8">
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                <Mail className="inline w-4 h-4 mr-2" />
                                Enter Your Email Address
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="reviewer@example.com"
                                    className="flex-1 px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                                    disabled={loading}
                                />
                                <button
                                    onClick={fetchReviewerInfo}
                                    disabled={loading}
                                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:bg-gray-400 flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-5 h-5" />
                                            Find Reviews
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-red-800">{error}</p>
                            </div>
                        )}

                        {/* Reviewer Info and Survey Links */}
                        {reviewerData && (
                            <div className="space-y-6">
                                {/* Reviewer Details */}
                                <div className="p-6 bg-green-50 border-2 border-green-200 rounded-lg">
                                    <div className="flex items-start gap-3 mb-4">
                                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">Welcome, {reviewerData.rev_name}!</h3>
                                            <p className="text-gray-600 text-sm mt-1">
                                                You have {reviewerData.proposals_count} proposal(s) assigned for review
                                            </p>
                                        </div>
                                    </div>

                                    {/* Google Drive Folder Link */}
                                    {reviewerData.folder_url && (
                                        <div className="mt-4 pt-4 border-t border-green-300">
                                            <a
                                                href={reviewerData.folder_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-green-700 hover:text-green-900 font-medium"
                                            >
                                                <FileText className="w-4 h-4" />
                                                📂 View Your Assigned Proposals in Google Drive
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* PRIMARY: REDCap Survey Queue */}
                                <div className="p-6 bg-blue-50 border-4 border-blue-400 rounded-lg shadow-lg">
                                    <div className="flex items-start gap-3 mb-4">
                                        <ClipboardList className="w-8 h-8 text-blue-600 flex-shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-xl mb-2">
                                                ⭐ Start Your Reviews (PRIMARY METHOD)
                                            </h3>
                                            <p className="text-gray-700 text-sm mb-4">
                                                Your personalized <strong>REDCap Survey Queue</strong> link should have been sent to your email: <strong>{reviewerData.rev_email}</strong>
                                            </p>
                                        </div>
                                    </div>

                                    {loadingSurveyUrl ? (
                                        <div className="flex items-center gap-3 px-8 py-4 bg-gray-100 rounded-lg">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                            <span className="text-gray-700">Loading survey queue...</span>
                                        </div>
                                    ) : surveyQueueUrl ? (
                                        <a
                                            href={surveyQueueUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg hover:shadow-xl text-lg"
                                        >
                                            <ClipboardList className="w-6 h-6" />
                                            Open REDCap Survey Queue
                                            <ExternalLink className="w-5 h-5" />
                                        </a>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-blue-100 border-2 border-blue-300 rounded-lg">
                                                <p className="text-blue-900 text-sm mb-3">
                                                    <strong>📧 Check your email inbox</strong> for the REDCap survey invitation sent to:
                                                </p>
                                                <p className="text-blue-800 font-mono text-sm bg-white px-3 py-2 rounded border border-blue-200">
                                                    {reviewerData.rev_email}
                                                </p>
                                                <p className="text-blue-700 text-xs mt-2">
                                                    The email contains your personalized survey queue link.
                                                </p>
                                            </div>

                                            <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                                                <p className="text-yellow-800 text-sm mb-3">
                                                    <strong>⚠️ Can't find the email?</strong>
                                                </p>
                                                <ul className="text-yellow-700 text-sm space-y-1 ml-4 list-disc">
                                                    <li>Check your spam/junk folder</li>
                                                    <li>Search for emails from "noreply@redcap.aphrc.org" or "surveys.aphrc.org"</li>
                                                    <li>Email subject likely contains "Survey Queue" or "Marking Sheet"</li>
                                                </ul>
                                            </div>

                                            <div className="p-4 bg-white border-2 border-gray-300 rounded-lg">
                                                <p className="text-gray-700 text-sm mb-3">
                                                    <strong>Still can't find it?</strong> Request a new survey invitation:
                                                </p>
                                                <a
                                                    href={`mailto:glegacy@aphrc.org?subject=Request Survey Queue Link&body=Hello,%0D%0A%0D%0AI need my REDCap survey queue link resent.%0D%0A%0D%0AReviewer Name: ${reviewerData.rev_name}%0D%0AEmail: ${reviewerData.rev_email}%0D%0ARecord ID: ${reviewerData.record_id}%0D%0A%0D%0AThank you!`}
                                                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                                                >
                                                    <Mail className="w-5 h-5" />
                                                    Email Secretariat for Link
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                                        <p className="text-xs text-blue-900">
                                            <strong>💡 Tip:</strong> The REDCap survey queue allows you to complete all {reviewerData.proposals_count} reviews sequentially and automatically saves your progress.
                                        </p>
                                    </div>
                                </div>

                                {/* SECONDARY: Backup Form */}
                                <div className="p-6 bg-gray-50 border-2 border-gray-300 rounded-lg">
                                    <div className="flex items-start gap-3 mb-4">
                                        <FileText className="w-6 h-6 text-gray-600 flex-shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-gray-800 mb-2">
                                                Alternative: Backup Review Form
                                            </h3>
                                            <p className="text-gray-600 text-sm mb-3">
                                                If you experience issues with the REDCap survey queue, you can use our backup submission system.
                                            </p>
                                        </div>
                                    </div>

                                    <a
                                        href="/reviews"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
                                    >
                                        <FileText className="w-5 h-5" />
                                        Open Backup Form
                                        <ExternalLink className="w-4 h-4" />
                                    </a>

                                    <p className="text-xs text-gray-500 mt-3">
                                        <strong>Note:</strong> When using the backup form, make sure to enter your email ({reviewerData.rev_email}) to link your reviews to your account.
                                    </p>
                                </div>

                                {/* Assigned Proposals List */}
                                <div className="p-6 bg-white border-2 border-gray-300 rounded-lg">
                                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <FileText className="w-5 h-5" />
                                        Your Assigned Proposals ({surveyLinks.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {surveyLinks.map((link, index) => (
                                            <div
                                                key={index}
                                                className={`p-4 rounded-lg border-2 ${
                                                    link.completed
                                                        ? 'bg-green-50 border-green-300'
                                                        : 'bg-gray-50 border-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {link.completed ? (
                                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border-2 border-gray-400"></div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-gray-800">
                                                                {link.candidateName}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {link.completed ? '✅ Review completed' : '⏳ Pending review'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <p className="text-xs text-gray-600">
                                            <strong>Progress:</strong> {surveyLinks.filter(l => l.completed).length} of {surveyLinks.length} reviews completed
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-white rounded-lg p-6 shadow-lg">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-600" />
                        Instructions
                    </h3>
                    <ol className="space-y-2 text-gray-600 text-sm list-decimal list-inside">
                        <li><strong>Enter your email</strong> above to load your review assignments</li>
                        <li><strong>View your proposals</strong> in Google Drive (link provided)</li>
                        <li><strong>Complete reviews</strong> using the REDCap Survey Queue (recommended)</li>
                        <li><strong>Alternative:</strong> Use the backup form if you encounter any issues</li>
                    </ol>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-900">
                            💡 <strong>Need help?</strong> If you cannot find your assignments or encounter technical issues, please contact the secretariat.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}