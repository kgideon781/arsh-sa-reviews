import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function MarkingSheetBackup() {
    const [reviewerDetails, setReviewerDetails] = useState(null);
    const [assignedCandidates, setAssignedCandidates] = useState([]);
    const [loadingReviewer, setLoadingReviewer] = useState(false);
    const [reviewerError, setReviewerError] = useState('');
    const [existingReviews, setExistingReviews] = useState([]);
    const [selectedReviewInstance, setSelectedReviewInstance] = useState(null);

    const [formData, setFormData] = useState({
        reviewer_name: '',
        reviewer_email: '',
        candidate_names: '',
        review_date: new Date().toISOString().split('T')[0],

        // Round 2 scoring fields with new ranges (Total: 100)
        innovation_originality: 0,      // 0-23
        relevance: 0,                   // 0-18
        feasibility: 0,                 // 0-18
        applicant_potential: 0,         // 0-13
        diversity_inclusion: 0,         // 0-9
        collaboration: 0,               // 0-9
        applicant_cv: 0,                // 0-10

        // Overall assessment - text fields only
        strength_of_proposal: '',
        areas_for_improvement: '',
        final_recommendation: ''
    });

    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Only persist reviewer email for convenience
    React.useEffect(() => {
        const savedEmail = localStorage.getItem('reviewer_email');
        if (savedEmail) {
            setFormData(prev => ({ ...prev, reviewer_email: savedEmail }));
            fetchReviewerDetails(savedEmail);
        }
    }, []);

    React.useEffect(() => {
        if (formData.reviewer_email && formData.reviewer_email.includes('@')) {
            localStorage.setItem('reviewer_email', formData.reviewer_email);
        }
    }, [formData.reviewer_email]);

    // Compute available candidates (filter out already reviewed)
    const getAvailableCandidates = () => {
        if (assignedCandidates.length === 0) return [];

        return assignedCandidates.filter(candidate => {
            // Check if this candidate has already been reviewed
            const alreadyReviewed = existingReviews.some(
                review => review.candidate_names === candidate
            );
            return !alreadyReviewed;
        });
    };

    const availableCandidates = getAvailableCandidates();
    const reviewedCount = assignedCandidates.length - availableCandidates.length;

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
                token: '61D8A52BF9C6221AE9201EB9272C82A1',
                content: 'record',
                format: 'json',
                type: 'flat',
                records: recordId,
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

            console.log('=== fetchExistingReviews Debug ===');
            console.log('Record ID:', recordId);
            console.log('Total records returned:', data.length);
            console.log('Raw data:', JSON.stringify(data, null, 2));

            // Filter for reviews - a record is a review if it has candidate_names
            // IMPORTANT: Only count as completed if marking_sheet_complete is '2' (Complete)
            const reviews = data.filter(item => {
                const hasCandidate = item.candidate_names && item.candidate_names.trim() !== '';

                // Check if it's from marking_sheet (if field exists) or just has candidate data
                const isMarkingSheet = !item.redcap_repeat_instrument ||
                    item.redcap_repeat_instrument === 'marking_sheet';

                // CRITICAL: Only include if form is marked as Complete (2)
                const isComplete = item.marking_sheet_complete === '2';

                console.log('Checking item:', {
                    has_repeat_instrument: !!item.redcap_repeat_instrument,
                    redcap_repeat_instrument: item.redcap_repeat_instrument,
                    redcap_repeat_instance: item.redcap_repeat_instance,
                    candidate_names: item.candidate_names,
                    marking_sheet_complete: item.marking_sheet_complete,
                    hasCandidate,
                    isMarkingSheet,
                    isComplete,
                    willInclude: hasCandidate && isMarkingSheet && isComplete
                });

                return hasCandidate && isMarkingSheet && isComplete;
            });

            console.log('Filtered reviews count:', reviews.length);
            console.log('Review candidates:', reviews.map(r => r.candidate_names));
            console.log('===========================');

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
                token: '61D8A52BF9C6221AE9201EB9272C82A1',
                content: 'record',
                format: 'json',
                type: 'flat',
                forms: 'reviewer_details',
                filterLogic: `[rev_email]="${email}"`,
                returnFormat: 'json'
            });

            const response = await fetch('https://surveys.aphrc.org/redcap/api/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formBody.toString()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (data && data.length > 0) {
                const reviewer = data[0];
                setReviewerDetails(reviewer);

                if (reviewer.assigned_proposals) {
                    const candidates = reviewer.assigned_proposals
                        .split(',')
                        .map(c => c.trim())
                        .filter(c => c.length > 0);
                    setAssignedCandidates(candidates);
                }

                if (reviewer.rev_name) {
                    setFormData(prev => ({ ...prev, reviewer_name: reviewer.rev_name }));
                }

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
            review_date: review.review_date || new Date().toISOString().split('T')[0],
            innovation_originality: parseInt(review.innovation_originality || 0),
            relevance: parseInt(review.relevance || 0),
            feasibility: parseInt(review.feasibility || 0),
            applicant_potential: parseInt(review.applicant_potential || 0),
            diversity_inclusion: parseInt(review.diversity_inclusion || 0),
            collaboration: parseInt(review.collaboration || 0),
            applicant_cv: parseInt(review.applicant_cv || 0),
            strength_of_proposal: review.strength_of_proposal || '',
            areas_for_improvement: review.areas_for_improvement || '',
            final_recommendation: review.final_recommendation || ''
        });

        setStatus({
            type: 'info',
            message: `Editing review for: ${review.candidate_names} (Instance ${review.redcap_repeat_instance})`
        });
    };

    // Reset to new entry mode
    const resetToNewEntry = () => {
        setSelectedReviewInstance(null);
        setFormData(prev => ({
            ...prev,
            candidate_names: '',
            review_date: new Date().toISOString().split('T')[0],
            innovation_originality: 0,
            relevance: 0,
            feasibility: 0,
            applicant_potential: 0,
            diversity_inclusion: 0,
            collaboration: 0,
            applicant_cv: 0,
            strength_of_proposal: '',
            areas_for_improvement: '',
            final_recommendation: ''
        }));
        setStatus({ type: '', message: '' });
    };

    const calculateTotal = () => {
        return parseInt(formData.innovation_originality || 0) +
            parseInt(formData.relevance || 0) +
            parseInt(formData.feasibility || 0) +
            parseInt(formData.applicant_potential || 0) +
            parseInt(formData.diversity_inclusion || 0) +
            parseInt(formData.collaboration || 0) +
            parseInt(formData.applicant_cv || 0);
    };

    const getNextRepeatInstance = async (recordId) => {
        if (!recordId) throw new Error('Record ID is missing');

        try {
            const formBody = new URLSearchParams({
                token: '61D8A52BF9C6221AE9201EB9272C82A1',
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

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            const markingSheetInstances = data.filter(item =>
                item.redcap_repeat_instrument === 'marking_sheet' &&
                item.redcap_repeat_instance
            );

            if (markingSheetInstances.length === 0) return 1;

            const instanceNumbers = markingSheetInstances.map(item =>
                parseInt(item.redcap_repeat_instance)
            );

            return Math.max(...instanceNumbers) + 1;
        } catch (error) {
            console.error('Error in getNextRepeatInstance:', error);
            throw error;
        }
    };

    const handleSubmit = async () => {
        if (!formData.reviewer_name || !formData.reviewer_email || !formData.candidate_names) {
            setStatus({
                type: 'error',
                message: 'Please fill in all required fields (Reviewer Name, Email, and Candidate Names)'
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (!formData.strength_of_proposal || !formData.areas_for_improvement || !formData.final_recommendation) {
            setStatus({
                type: 'error',
                message: 'Please complete the Overall Assessment section (Strengths, Areas for Improvement, and Final Recommendation)'
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setIsSubmitting(true);
        setStatus({ type: '', message: '' });

        try {
            const recordId = reviewerDetails.record_id;

            let instanceToUse;
            if (selectedReviewInstance !== null) {
                instanceToUse = selectedReviewInstance;
            } else {
                instanceToUse = await getNextRepeatInstance(recordId);
            }

            const redcapData = [{
                record_id: recordId,
                redcap_repeat_instrument: 'marking_sheet',
                redcap_repeat_instance: instanceToUse,
                reviewer_name: formData.reviewer_name,
                reviewer_email: formData.reviewer_email,
                candidate_names: formData.candidate_names,
                review_date: formData.review_date,
                innovation_originality: formData.innovation_originality,
                relevance: formData.relevance,
                feasibility: formData.feasibility,
                applicant_potential: formData.applicant_potential,
                diversity_inclusion: formData.diversity_inclusion,
                collaboration: formData.collaboration,
                applicant_cv: formData.applicant_cv,
                strength_of_proposal: formData.strength_of_proposal,
                areas_for_improvement: formData.areas_for_improvement,
                final_recommendation: formData.final_recommendation,
                marking_sheet_complete: '2'
            }];

            const formBody = new URLSearchParams({
                token: '61D8A52BF9C6221AE9201EB9272C82A1',
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
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formBody.toString()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`REDCap API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            const action = selectedReviewInstance !== null ? 'updated' : 'submitted';
            setStatus({
                type: 'success',
                message: `Review ${action} successfully! Instance #${instanceToUse} for ${formData.candidate_names}. Total Score: ${calculateTotal()}/100`
            });

            // Scroll to top to show success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Refresh the existing reviews list to update the dropdown
            await fetchExistingReviews(recordId);

            if (selectedReviewInstance === null) {
                // Reset form for new entry and CLEAR candidate selection
                setFormData(prev => ({
                    ...prev,
                    candidate_names: '',  // Clear the selected candidate
                    review_date: new Date().toISOString().split('T')[0],
                    innovation_originality: 0,
                    relevance: 0,
                    feasibility: 0,
                    applicant_potential: 0,
                    diversity_inclusion: 0,
                    collaboration: 0,
                    applicant_cv: 0,
                    strength_of_proposal: '',
                    areas_for_improvement: '',
                    final_recommendation: ''
                }));
            } else {
                setSelectedReviewInstance(null);
            }

        } catch (error) {
            console.error('Submission error:', error);
            setStatus({
                type: 'error',
                message: `Failed to submit review: ${error.message}`
            });

            // Scroll to top to show error message
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get percentage info for continuous sliders
    const getPercentageInfo = (field, value) => {
        const ranges = {
            'innovation_originality': { min: 0, max: 23 },
            'relevance': { min: 0, max: 18 },
            'feasibility': { min: 0, max: 18 },
            'applicant_potential': { min: 0, max: 13 },
            'diversity_inclusion': { min: 0, max: 9 },
            'collaboration': { min: 0, max: 9 },
            'applicant_cv': { min: 0, max: 10 }
        };

        const info = ranges[field] || { min: 0, max: 10 };
        const percentage = Math.round(((value - info.min) / (info.max - info.min)) * 100);
        return { ...info, percentage };
    };

    // Continuous slider component
    const ScoreSlider = ({ label, field, value, description }) => {
        const info = getPercentageInfo(field, value);

        return (
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-gray-800">{label}</label>
                    <div className="text-right">
                        <span className="text-2xl font-bold" style={{ color: '#7bc148' }}>
                            {value}
                        </span>
                        <span className="text-sm text-gray-600 ml-2">
                            / {info.max} ({info.percentage}%)
                        </span>
                    </div>
                </div>
                {description && (
                    <p className="text-xs text-gray-700 mb-3 italic">{description}</p>
                )}
                <input
                    type="range"
                    min={info.min}
                    max={info.max}
                    step={1}
                    value={value}
                    onChange={(e) => handleSliderChange(field, e.target.value)}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #7bc148 0%, #7bc148 ${((value - info.min) / (info.max - info.min)) * 100}%, #e5e7eb ${((value - info.min) / (info.max - info.min)) * 100}%, #e5e7eb 100%)`
                    }}
                />
                <div className="flex justify-between text-xs text-gray-700 mt-1 font-medium">
                    <span>0 - Needs Improvement</span>
                    <span>{Math.round(info.max / 2)} - Satisfactory</span>
                    <span>{info.max} - Excellent</span>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: '#7bc148' }}>
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-4 border-white">
                    {/* Header */}
                    <div className="p-8 text-white" style={{ backgroundColor: '#7bc148' }}>
                        <h1 className="text-3xl font-bold mb-2">Research Proposal Review Form</h1>
                        <p className="text-green-50">Round 2 - Complete your evaluation below</p>
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
                            <p className={`font-semibold ${
                                status.type === 'success' ? 'text-green-800' :
                                    status.type === 'error' ? 'text-red-800' :
                                        'text-blue-800'
                            }`}>
                                {status.message}
                            </p>
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
                                        <>
                                            <select
                                                value={formData.candidate_names}
                                                onChange={(e) => handleInputChange('candidate_names', e.target.value)}
                                                className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white"
                                            >
                                                <option value="">Select a candidate</option>
                                                {assignedCandidates.map((candidate, idx) => {
                                                    // Check if this candidate has been reviewed
                                                    const isReviewed = existingReviews.some(
                                                        review => review.candidate_names &&
                                                            review.candidate_names.trim() === candidate.trim()
                                                    );

                                                    return (
                                                        <option
                                                            key={idx}
                                                            value={candidate}
                                                            disabled={isReviewed}
                                                            style={isReviewed ? {
                                                                color: '#9ca3af',
                                                                backgroundColor: '#f3f4f6',
                                                                fontStyle: 'italic'
                                                            } : {}}
                                                        >
                                                            {candidate} {isReviewed ? '✓ (Reviewed)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>

                                            {/* Show completion message */}
                                            {availableCandidates.length === 0 && assignedCandidates.length > 0 && (
                                                <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4" />
                                                    All {assignedCandidates.length} assigned candidates have been reviewed! ✓
                                                </p>
                                            )}

                                            {/* Show progress */}
                                            {availableCandidates.length > 0 && (
                                                <p className="text-xs text-gray-600 mt-2">
                                                    {availableCandidates.length} of {assignedCandidates.length} candidates remaining to review
                                                    {reviewedCount > 0 && ` (${reviewedCount} completed ✓)`}
                                                </p>
                                            )}
                                        </>
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
                                field="innovation_originality"
                                value={formData.innovation_originality}
                                description="Is the proposed research novel offering a unique perspective?"
                            />

                            <ScoreSlider
                                label="Relevance"
                                field="relevance"
                                value={formData.relevance}
                                description="Does the research address key African health or development priorities/issues?"
                            />

                            <ScoreSlider
                                label="Feasibility"
                                field="feasibility"
                                value={formData.feasibility}
                                description="Are the objectives realistic and is the methodology sound and implementable?"
                            />

                            <ScoreSlider
                                label="Applicant Potential"
                                field="applicant_potential"
                                value={formData.applicant_potential}
                                description="Does the applicant have a solid research background and institutional support?"
                            />

                            <ScoreSlider
                                label="Diversity & Inclusion"
                                field="diversity_inclusion"
                                value={formData.diversity_inclusion}
                                description="Gender, geography, disciplinary balance (as per call)"
                            />

                            <ScoreSlider
                                label="Collaboration"
                                field="collaboration"
                                value={formData.collaboration}
                                description="Is there strong evidence of collaboration across institutions, disciplines, or countries?"
                            />

                            <ScoreSlider
                                label="Applicant CV"
                                field="applicant_cv"
                                value={formData.applicant_cv}
                                description="Quality, completeness, and relevance of CV (education, research grants, publications, presentations)"
                            />
                        </div>

                        {/* Overall Assessment */}
                        <div className="mb-8 pb-6 border-b-2 border-gray-400">
                            <h2 className="text-xl font-bold text-gray-800 mb-6">Overall Assessment</h2>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-800 mb-2">
                                    Strength of the Proposal *
                                </label>
                                <p className="text-xs text-gray-700 mb-3 italic">
                                    Summarize the key strengths of this proposal
                                </p>
                                <textarea
                                    value={formData.strength_of_proposal}
                                    onChange={(e) => handleInputChange('strength_of_proposal', e.target.value)}
                                    rows="4"
                                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white"
                                    placeholder="Describe the key strengths..."
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-800 mb-2">
                                    Areas for Improvement *
                                </label>
                                <p className="text-xs text-gray-700 mb-3 italic">
                                    Summarize the main areas needing improvement
                                </p>
                                <textarea
                                    value={formData.areas_for_improvement}
                                    onChange={(e) => handleInputChange('areas_for_improvement', e.target.value)}
                                    rows="4"
                                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white"
                                    placeholder="Describe areas for improvement..."
                                    required
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
                                            name="final_recommendation"
                                            value={option.value}
                                            checked={formData.final_recommendation === option.value}
                                            onChange={(e) => handleInputChange('final_recommendation', e.target.value)}
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
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-lg font-bold text-gray-800">
                                        Total Score (%):
                                    </span>
                                    <span className="text-4xl font-bold text-green-700">{calculateTotal()}</span>
                                </div>
                                <div className="text-sm text-gray-600 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>Innovation: {formData.innovation_originality}/23</div>
                                        <div>Relevance: {formData.relevance}/18</div>
                                        <div>Feasibility: {formData.feasibility}/18</div>
                                        <div>Potential: {formData.applicant_potential}/13</div>
                                        <div>Diversity: {formData.diversity_inclusion}/9</div>
                                        <div>Collaboration: {formData.collaboration}/9</div>
                                        <div>CV: {formData.applicant_cv}/10</div>
                                    </div>
                                    <div className="pt-2 border-t border-gray-300 font-bold">
                                        Maximum Possible: 100
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-white transition-all text-lg ${
                                    isSubmitting ? 'bg-gray-500 cursor-not-allowed' : 'shadow-lg hover:shadow-xl'
                                }`}
                                style={{
                                    backgroundColor: isSubmitting ? '#6b7280' : '#7bc148'
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
                    <p>Backup Submission System • Round 2 • Data synced to REDCap</p>
                </div>
            </div>
        </div>
    );
}