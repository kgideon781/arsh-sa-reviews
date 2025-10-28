import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function MarkingSheetBackup() {
    const [reviewerDetails, setReviewerDetails] = useState(null);
    const [assignedCandidates, setAssignedCandidates] = useState([]);
    const [loadingReviewer, setLoadingReviewer] = useState(false);
    const [reviewerError, setReviewerError] = useState('');
    const [existingReviews, setExistingReviews] = useState([]);
    const [selectedReviewInstance, setSelectedReviewInstance] = useState(null); // For updates

    const [formData, setFormData] = useState({
        reviewer_name: '',
        reviewer_email: '',
        candidate_names: '',
        bg_problem_clarity: 1,
        bg_justification: 1,
        bg_literature: 1,
        bg_rationale: 1,
        diversity: 1,
        collab: 1,
        applicant_cv: 1,
        strength_of_the_proposal1: 1,
        areas_for_improvement1: '',
        final_recommendation1: ''
    });

    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showToast, setShowToast] = useState(false);

    const handleSliderChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: parseInt(value) }));
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Fetch existing reviews for this reviewer
    const fetchExistingReviews = async (recordId) => {
        try {
            const formBody = new URLSearchParams({
                token: 'D139DF487922A7BA62DF951605B36389',
                content: 'record',
                format: 'json',
                type: 'flat',
                records: recordId, // Use 'records' parameter instead of filterLogic
                forms: 'marking_sheet',
                returnFormat: 'json'
            });

            const response = await fetch('https://surveys.aphrc.org/redcap/api/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formBody.toString()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            // Filter for marking_sheet repeating instrument only
            const reviews = data.filter(item =>
                item.redcap_repeat_instrument === 'marking_sheet' &&
                item.redcap_repeat_instance
            );

            setExistingReviews(reviews);
            return reviews;
        } catch (error) {
            console.error('Error fetching existing reviews:', error);
            return [];
        }
    };

    const fetchReviewerDetails = async (email) => {
        if (!email || !email.includes('@')) return;

        setLoadingReviewer(true);
        setReviewerError('');
        setExistingReviews([]);
        setSelectedReviewInstance(null);

        try {
            const formBody = new URLSearchParams({
                token: 'D139DF487922A7BA62DF951605B36389',
                content: 'record',
                format: 'json',
                type: 'flat',
                forms: 'reviewer_details',
                filterLogic: `[rev_email]="${email}"`,
                returnFormat: 'json'
            });

            const response = await fetch('https://surveys.aphrc.org/redcap/api/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formBody.toString()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.length > 0) {
                const reviewer = data[0];
                setReviewerDetails(reviewer);

                // Parse assigned proposals
                if (reviewer.assigned_proposals) {
                    const candidates = reviewer.assigned_proposals
                        .split(',')
                        .map(c => c.trim())
                        .filter(c => c.length > 0);
                    setAssignedCandidates(candidates);
                }

                // Auto-fill reviewer name
                if (reviewer.rev_name) {
                    setFormData(prev => ({ ...prev, reviewer_name: reviewer.rev_name }));
                }

                // Fetch existing reviews for this reviewer
                await fetchExistingReviews(reviewer.record_id);
            } else {
                setReviewerError('No reviewer found with this email. Please check and try again.');
                setAssignedCandidates([]);
            }
        } catch (error) {
            setReviewerError(`Failed to fetch reviewer details: ${error.message}`);
            setAssignedCandidates([]);
        } finally {
            setLoadingReviewer(false);
        }
    };

    const handleEmailChange = (email) => {
        handleInputChange('reviewer_email', email);

        // Auto-fetch when email looks valid
        if (email.includes('@') && email.includes('.')) {
            fetchReviewerDetails(email);
        }
    };

    // Load an existing review into the form for editing
    const loadReviewForEdit = (review) => {
        setSelectedReviewInstance(parseInt(review.redcap_repeat_instance));
        setFormData({
            reviewer_name: review.reviewer_name || '',
            reviewer_email: review.reviewer_email || '',
            candidate_names: review.candidate_names || '',
            bg_problem_clarity: parseInt(review.bg_problem_clarity || 1),
            bg_justification: parseInt(review.bg_justification || 1),
            bg_literature: parseInt(review.bg_literature || 1),
            bg_rationale: parseInt(review.bg_rationale || 1),
            diversity: parseInt(review.diversity || 1),
            collab: parseInt(review.collab || 1),
            applicant_cv: parseInt(review.applicant_cv || 1),
            strength_of_the_proposal1: parseInt(review.strength_of_the_proposal1 || 1),
            areas_for_improvement1: review.areas_for_improvement1 || '',
            final_recommendation1: review.final_recommendation1 || ''
        });

        setStatus({
            type: 'info',
            message: `Editing review for: ${review.candidate_names} (Instance ${review.redcap_repeat_instance})`
        });
    };

    // Clear form and reset to new entry mode
    const resetToNewEntry = () => {
        setSelectedReviewInstance(null);
        setFormData(prev => ({
            ...prev,
            candidate_names: '',
            bg_problem_clarity: 1,
            bg_justification: 1,
            bg_literature: 1,
            bg_rationale: 1,
            diversity: 1,
            collab: 1,
            applicant_cv: 1,
            strength_of_the_proposal1: 1,
            areas_for_improvement1: '',
            final_recommendation1: ''
        }));
        setStatus({ type: '', message: '' });
    };

    const calculateTotal = () => {
        return formData.bg_problem_clarity +
            formData.bg_justification +
            formData.bg_literature +
            formData.bg_rationale +
            formData.diversity +
            formData.collab +
            formData.applicant_cv;
    };

    const getNextRepeatInstance = async (recordId) => {
        if (!recordId) {
            console.error('❌ Record ID is missing');
            throw new Error('Record ID is missing');
        }

        console.log('🔍 Fetching existing instances for record:', recordId);

        try {
            // Fetch ALL data for this specific record
            const formBody = new URLSearchParams({
                token: 'D139DF487922A7BA62DF951605B36389',
                content: 'record',
                format: 'json',
                type: 'flat',
                records: recordId,
                returnFormat: 'json'
            });

            const response = await fetch('https://surveys.aphrc.org/redcap/api/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formBody.toString()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📦 Raw data from REDCap:', data);

            // Filter ONLY for marking_sheet repeating instances
            const markingSheetInstances = data.filter(item => {
                const isMarkingSheet = item.redcap_repeat_instrument === 'marking_sheet';
                const hasInstance = item.redcap_repeat_instance && item.redcap_repeat_instance !== '';
                return isMarkingSheet && hasInstance;
            });

            console.log('📋 Filtered marking_sheet instances:', markingSheetInstances);
            console.log('📊 Number of existing instances:', markingSheetInstances.length);

            // If no previous instances exist, start at 1
            if (markingSheetInstances.length === 0) {
                console.log('✅ No existing instances found. Starting at instance 1');
                return 1;
            }

            // Extract all instance numbers and find the maximum
            const instanceNumbers = markingSheetInstances.map(item => {
                const num = parseInt(item.redcap_repeat_instance);
                console.log('  - Found instance number:', num);
                return num;
            });

            const maxInstance = Math.max(...instanceNumbers);
            const nextInstance = maxInstance + 1;

            console.log(`✅ Max existing instance: ${maxInstance}`);
            console.log(`✅ Next instance will be: ${nextInstance}`);

            return nextInstance;
        } catch (error) {
            console.error('❌ Error in getNextRepeatInstance:', error);
            throw error;
        }
    };


    const handleSubmit = async () => {
        if (!formData.reviewer_name || !formData.reviewer_email || !formData.candidate_names) {
            setStatus({
                type: 'error',
                message: 'Please fill in all required fields (Reviewer Name, Email, and Candidate Names)'
            });
            return;
        }

        setIsSubmitting(true);
        setStatus({ type: '', message: '' });

        try {
            const recordId = reviewerDetails.record_id;
            console.log('📝 Starting submission for record:', recordId);

            // Determine if we're updating or creating
            let instanceToUse;
            if (selectedReviewInstance !== null) {
                // We're updating an existing review
                instanceToUse = selectedReviewInstance;
                console.log('🔄 UPDATE MODE: Using existing instance', instanceToUse);
            } else {
                // We're creating a new review - get the next instance dynamically
                console.log('➕ CREATE MODE: Getting next instance number...');
                instanceToUse = await getNextRepeatInstance(recordId);
                console.log('➕ Will create new instance:', instanceToUse);
            }

            const redcapData = [{
                record_id: recordId,
                redcap_repeat_instrument: 'marking_sheet',
                redcap_repeat_instance: instanceToUse,
                reviewer_name: formData.reviewer_name,
                reviewer_email: formData.reviewer_email,
                candidate_names: formData.candidate_names,
                bg_problem_clarity: formData.bg_problem_clarity,
                bg_justification: formData.bg_justification,
                bg_literature: formData.bg_literature,
                bg_rationale: formData.bg_rationale,
                diversity: formData.diversity,
                collab: formData.collab,
                applicant_cv: formData.applicant_cv,
                format_total: calculateTotal(),
                strength_of_the_proposal1: formData.strength_of_the_proposal1,
                areas_for_improvement1: formData.areas_for_improvement1,
                final_recommendation1: formData.final_recommendation1,
                marking_sheet_complete: '2'
            }];

            console.log('📤 Sending data to REDCap:', redcapData);

            const formBody = new URLSearchParams({
                token: 'D139DF487922A7BA62DF951605B36389',
                content: 'record',
                format: 'json',
                type: 'flat',
                overwriteBehavior: 'overwrite',
                returnContent: 'ids',
                returnFormat: 'json',
                data: JSON.stringify(redcapData)
            });

            const response = await fetch('https://surveys.aphrc.org/redcap/api/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formBody.toString()
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ REDCap API error:', errorText);
                throw new Error(`REDCap API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ REDCap response:', result);

            const action = selectedReviewInstance !== null ? 'updated' : 'submitted';
            setStatus({
                type: 'success',
                message: `Review ${action} successfully! Instance #${instanceToUse} for ${formData.candidate_names}`
            });

            // Scroll to top to show success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Show toast notification
            setShowToast(true);
            setTimeout(() => setShowToast(false), 5000); // Hide after 5 seconds

            // Refresh the existing reviews list
            await fetchExistingReviews(recordId);

            // Reset to new entry mode after successful submission
            if (selectedReviewInstance === null) {
                // Only reset form if it was a new entry
                setFormData(prev => ({
                    ...prev,
                    candidate_names: '',
                    bg_problem_clarity: 1,
                    bg_justification: 1,
                    bg_literature: 1,
                    bg_rationale: 1,
                    diversity: 1,
                    collab: 1,
                    applicant_cv: 1,
                    strength_of_the_proposal1: 1,
                    areas_for_improvement1: '',
                    final_recommendation1: ''
                }));
            } else {
                // If updating, keep the form as is but clear the selected instance
                setSelectedReviewInstance(null);
            }

        } catch (error) {
            console.error('❌ Submission error:', error);
            setStatus({
                type: 'error',
                message: `Failed to submit review: ${error.message}`
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Slider component
    const ScoreSlider = ({ label, field, value, description }) => (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-gray-800">{label}</label>
                <span className="text-2xl font-bold" style={{ color: '#7bc148' }}>{value}</span>
            </div>
            {description && (
                <p className="text-xs text-gray-700 mb-3 italic">{description}</p>
            )}
            <input
                type="range"
                min="1"
                max="3"
                value={value}
                onChange={(e) => handleSliderChange(field, e.target.value)}
                className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                style={{
                    background: `linear-gradient(to right, #7bc148 0%, #7bc148 ${((value - 1) / 2) * 100}%, #e5e7eb ${((value - 1) / 2) * 100}%, #e5e7eb 100%)`
                }}
            />
            <div className="flex justify-between text-xs text-gray-700 mt-1 font-medium">
                <span>1 - Poor</span>
                <span>2 - Good</span>
                <span>3 - Excellent</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: '#7bc148' }}>
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-4 border-white">
                    {/* Header */}
                    <div className="p-8 text-white" style={{ backgroundColor: '#7bc148' }}>
                        <h1 className="text-3xl font-bold mb-2">Research Proposal Review Form</h1>
                        <p className="text-green-50">Complete your evaluation below</p>
                    </div>

                    {/* Status Messages */}
                    {status.message && (
                        <div className={`mx-8 mt-6 p-4 rounded-lg flex items-start gap-3 ${
                            status.type === 'success' ? 'bg-green-50 border-2 border-green-500' :
                                status.type === 'error' ? 'bg-red-50 border-2 border-red-500' :
                                    'bg-blue-50 border-2 border-blue-500'
                        }`}>
                            {status.type === 'success' && <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />}
                            {status.type === 'error' && <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />}
                            {status.type === 'info' && <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />}
                            <div>
                                <p className={`font-semibold ${
                                    status.type === 'success' ? 'text-green-800' :
                                        status.type === 'error' ? 'text-red-800' :
                                            'text-blue-800'
                                }`}>
                                    {status.message}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Existing Reviews Section */}
                    {existingReviews.length > 0 && (
                        <div className="mx-8 mt-6 p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-gray-800">Your Previous Reviews</h3>
                                <button
                                    onClick={resetToNewEntry}
                                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                    + New Review
                                </button>
                            </div>
                            <div className="space-y-2">
                                {existingReviews.map((review) => (
                                    <div
                                        key={review.redcap_repeat_instance}
                                        className={`p-3 bg-white rounded border-2 cursor-pointer hover:border-green-500 transition-colors ${
                                            selectedReviewInstance === parseInt(review.redcap_repeat_instance)
                                                ? 'border-green-600 bg-green-50'
                                                : 'border-gray-200'
                                        }`}
                                        onClick={() => loadReviewForEdit(review)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-gray-800">
                                                    {review.candidate_names || 'Unnamed Candidate'}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Score: {review.format_total || 'N/A'}
                                                </p>
                                            </div>
                                            <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                                Instance #{review.redcap_repeat_instance}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Form Content */}
                    <div className="p-8">
                        {/* Reviewer Details */}
                        <div className="mb-8 pb-6 border-b-2 border-gray-400">
                            <h2 className="text-xl font-bold text-gray-800 mb-6">Reviewer Details</h2>

                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        Reviewer Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.reviewer_email}
                                        onChange={(e) => handleEmailChange(e.target.value)}
                                        className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white"
                                        placeholder="Enter your email to load details"
                                    />
                                    {loadingReviewer && (
                                        <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading reviewer details...
                                        </p>
                                    )}
                                    {reviewerError && (
                                        <p className="text-sm text-red-600 mt-2">{reviewerError}</p>
                                    )}
                                    {reviewerDetails && (
                                        <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" />
                                            Reviewer found: {reviewerDetails.rev_name}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        Reviewer Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.reviewer_name}
                                        onChange={(e) => handleInputChange('reviewer_name', e.target.value)}
                                        className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white"
                                        placeholder="Auto-filled from email"
                                        disabled={!reviewerDetails}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        Candidate Names *
                                    </label>
                                    {assignedCandidates.length > 0 ? (
                                        <select
                                            value={formData.candidate_names}
                                            onChange={(e) => handleInputChange('candidate_names', e.target.value)}
                                            className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white"
                                        >
                                            <option value="">Select a candidate</option>
                                            {assignedCandidates.map((candidate, idx) => (
                                                <option key={idx} value={candidate}>{candidate}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={formData.candidate_names}
                                            onChange={(e) => handleInputChange('candidate_names', e.target.value)}
                                            className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white"
                                            placeholder="Enter candidate names or enter email above to load assigned proposals"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Research Proposal Section */}
                        <div className="mb-8 pb-6 border-b-2 border-gray-400">
                            <h2 className="text-xl font-bold text-gray-800 mb-6">Research Proposal</h2>

                            <ScoreSlider
                                label="Innovation and Originality"
                                field="bg_problem_clarity"
                                value={formData.bg_problem_clarity}
                                description="Is the proposed research novel offering a unique perspective?"
                            />

                            <ScoreSlider
                                label="Relevance"
                                field="bg_justification"
                                value={formData.bg_justification}
                                description="Does the research address key African health or development priorities/issues?"
                            />

                            <ScoreSlider
                                label="Feasibility"
                                field="bg_literature"
                                value={formData.bg_literature}
                                description="Are the objectives realistic and is the methodology sound and implementable?"
                            />

                            <ScoreSlider
                                label="Applicant Potential"
                                field="bg_rationale"
                                value={formData.bg_rationale}
                                description="Does the applicant have a solid research background and institutional support?"
                            />

                            <ScoreSlider
                                label="Diversity & Inclusion"
                                field="diversity"
                                value={formData.diversity}
                                description="Gender, geography, disciplinary balance (as per call)"
                            />

                            <ScoreSlider
                                label="Collaboration"
                                field="collab"
                                value={formData.collab}
                                description="Is there strong evidence of collaboration across institutions, disciplines, or countries?"
                            />

                            <ScoreSlider
                                label="Applicant CV"
                                field="applicant_cv"
                                value={formData.applicant_cv}
                                description="Quality, completeness, and relevance of CV (education, research grants, publications, presentations)"
                            />
                        </div>

                        {/* Reviewer Notes */}
                        <div className="mb-8 pb-6 border-b-2 border-gray-400">
                            <h2 className="text-xl font-bold text-gray-800 mb-6">Reviewer Notes</h2>

                            <ScoreSlider
                                label="Strength of the proposal"
                                field="strength_of_the_proposal1"
                                value={formData.strength_of_the_proposal1}
                            />

                            <div className="mt-6">
                                <label className="block text-sm font-bold text-gray-800 mb-2">
                                    Areas for Improvement *
                                </label>
                                <textarea
                                    value={formData.areas_for_improvement1}
                                    onChange={(e) => handleInputChange('areas_for_improvement1', e.target.value)}
                                    rows="6"
                                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white"
                                    placeholder="Enter areas for improvement..."
                                />
                            </div>
                        </div>

                        {/* Final Recommendation */}
                        <div className="mb-8 pb-6 border-b-2 border-gray-400">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Final Recommendation *</h2>

                            <div className="space-y-3">
                                {[
                                    { value: '1', label: 'Strongly recommend' },
                                    { value: '2', label: 'Recommend' },
                                    { value: '3', label: 'Do not recommend' }
                                ].map((option) => (
                                    <label key={option.value} className="flex items-center p-3 border-2 border-gray-400 rounded-lg cursor-pointer hover:bg-white transition-colors bg-white">
                                        <input
                                            type="radio"
                                            name="final_recommendation1"
                                            value={option.value}
                                            checked={formData.final_recommendation1 === option.value}
                                            onChange={(e) => handleInputChange('final_recommendation1', e.target.value)}
                                            className="w-5 h-5 text-green-600 focus:ring-2 focus:ring-green-600"
                                            style={{ accentColor: '#7bc148' }}
                                        />
                                        <span className="ml-3 text-gray-800 font-medium">{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Total Score Display */}
                        <div className="mb-8">
                            <div className="bg-white p-6 rounded-lg border-2 border-gray-400">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-800">Total Score (Out of 21, Range: 7-21):</span>
                                    <span className="text-3xl font-bold text-green-700">{calculateTotal()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-white transition-all text-lg ${
                                    isSubmitting
                                        ? 'bg-gray-500 cursor-not-allowed'
                                        : 'shadow-lg hover:shadow-xl'
                                }`}
                                style={{
                                    backgroundColor: isSubmitting ? '#6b7280' : '#7bc148',
                                    ':hover': { backgroundColor: '#6aa03a' }
                                }}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        {selectedReviewInstance !== null ? 'Updating...' : 'Submitting...'}
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-6 h-6" />
                                        {selectedReviewInstance !== null ? 'Update Review' : 'Submit Review'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center text-sm text-white font-medium">
                    <p>Backup Submission System • Data will be synced to REDCap</p>
                </div>
            </div>

            {/* Floating Toast Notification */}
            {showToast && (
                <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-up max-w-md z-50">
                    <CheckCircle className="w-6 h-6 flex-shrink-0" />
                    <div>
                        <p className="font-bold">Success!</p>
                        <p className="text-sm">Your review has been {selectedReviewInstance !== null ? 'updated' : 'submitted'} successfully.</p>
                    </div>
                    <button
                        onClick={() => setShowToast(false)}
                        className="ml-2 text-white hover:text-green-100 flex-shrink-0"
                    >
                        ✕
                    </button>
                </div>
            )}

            <style>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}