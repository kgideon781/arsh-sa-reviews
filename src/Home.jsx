import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Search, Users, FileText, CheckCircle, AlertCircle, RefreshCw, Filter } from 'lucide-react';

const ProposalsReviewDashboard = () => {
    const [allData, setAllData] = useState([]);
    const [groupedData, setGroupedData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState('all');
    const [selectedRecommendation, setSelectedRecommendation] = useState('all');
    const [reviewCountFilter, setReviewCountFilter] = useState('all');
    const [improvementModal, setImprovementModal] = useState({ open: false, candidate: '', reviewer: '', text: '' });

    const API_URL = 'https://surveys.aphrc.org/redcap/api/';
    const API_TOKEN = '639A1D732E66AD86D555D4E191C8B467';

    // HTML parsing function
    const parseHTML = (html) => {
        if (!html) return '';

        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Get text content (strips HTML tags)
        let text = temp.textContent || temp.innerText || '';

        // Clean up common HTML entities
        text = text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            // Clean up excessive whitespace
            .replace(/\s+/g, ' ')
            .trim();

        return text;
    };

    // Open improvement modal
    const openImprovementModal = (candidate, reviewer, htmlText) => {
        const parsedText = parseHTML(htmlText);
        setImprovementModal({
            open: true,
            candidate,
            reviewer,
            text: parsedText || 'No comments provided'
        });
    };

    // Close improvement modal
    const closeImprovementModal = () => {
        setImprovementModal({ open: false, candidate: '', reviewer: '', text: '' });
    };

    // Smart name matching functions
    const normalizeNameForMatching = (name) => {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const findMatchingCandidate = (candidateName, existingCandidates) => {
        if (!candidateName) return null;

        const normalized = normalizeNameForMatching(candidateName);
        const words = normalized.split(' ');

        for (let existing of existingCandidates) {
            if (normalizeNameForMatching(existing) === normalized) {
                return existing;
            }
        }

        if (words.length >= 2) {
            for (let existing of existingCandidates) {
                const existingWords = normalizeNameForMatching(existing).split(' ');
                let matchCount = 0;

                for (let word of words) {
                    if (existingWords.some(ew => ew === word || ew.includes(word) || word.includes(ew))) {
                        matchCount++;
                    }
                }

                if (matchCount >= 2 || matchCount >= Math.ceil(Math.min(words.length, existingWords.length) * 0.6)) {
                    return existing;
                }
            }
        }

        return candidateName;
    };

    // Fetch data from REDCap
    const fetchData = async () => {
        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('token', API_TOKEN);
            formData.append('content', 'record');
            formData.append('format', 'json');
            formData.append('type', 'flat');
            formData.append('rawOrLabel', 'raw');
            formData.append('rawOrLabelHeaders', 'raw');
            formData.append('exportCheckboxLabel', 'false');
            formData.append('exportSurveyFields', 'false');
            formData.append('exportDataAccessGroups', 'false');
            formData.append('returnFormat', 'json');

            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            const filteredData = data.filter(record => {
                const hasReviewData = (
                    (record.reviewer_name && record.reviewer_name !== '') &&
                    (record.candidate_names && record.candidate_names !== '') &&
                    (record.final_recommendation1 && record.final_recommendation1 !== '') &&
                    (record.bg_problem_clarity && record.bg_problem_clarity !== '') &&
                    (record.format_total && record.format_total !== '')
                );
                return hasReviewData;
            });

            if (filteredData.length === 0) {
                setError('No complete and valid reviews found.');
                setLoading(false);
                return;
            }

            setAllData(filteredData);
            processData(filteredData);

        } catch (err) {
            setError(`Error fetching data: ${err.message}`);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Process and group data by candidate
    const processData = (data) => {
        const grouped = {};
        const candidateMap = new Map();

        data.forEach(record => {
            let candidateName = record.candidate_names || 'Unknown Candidate';

            const existingCandidates = Array.from(candidateMap.keys());
            const matchedCandidate = findMatchingCandidate(candidateName, existingCandidates);

            if (matchedCandidate && matchedCandidate !== candidateName) {
                candidateName = candidateMap.get(matchedCandidate);
            } else {
                candidateMap.set(candidateName, candidateName);
            }

            if (!grouped[candidateName]) {
                grouped[candidateName] = [];
            }

            // Calculate individual percentages if not provided
            // Using raw score / max score formula (e.g., 1/3 = 33%, 2/3 = 67%, 3/3 = 100%)
            const innovationPct = record.innovation_and_originality || ((parseFloat(record.bg_problem_clarity) / 3) * 100);
            const relevancePct = record.relevance || ((parseFloat(record.bg_justification) / 3) * 100);
            const feasibilityPct = record.feasibility || ((parseFloat(record.bg_literature) / 3) * 100);
            const potentialPct = record.app_potential || ((parseFloat(record.bg_rationale) / 3) * 100);
            const diversityPct = record.diversity_inclusion || ((parseFloat(record.diversity) / 3) * 100);
            const collabPct = record.diversity_inclusion_2 || ((parseFloat(record.collab) / 3) * 100);
            const cvPct = record.cv_applicant || ((parseFloat(record.applicant_cv) / 3) * 100);

            // Calculate total score percentage - ALWAYS calculate as backup
            // This matches REDCap's formula: round(((weighted sum) * 33.33), 2)
            const calculatedTotalPct = (
                (parseFloat(record.bg_problem_clarity) || 0) * 0.23 +
                (parseFloat(record.bg_justification) || 0) * 0.18 +
                (parseFloat(record.bg_literature) || 0) * 0.18 +
                (parseFloat(record.bg_rationale) || 0) * 0.13 +
                (parseFloat(record.diversity) || 0) * 0.09 +
                (parseFloat(record.collab) || 0) * 0.09 +
                (parseFloat(record.applicant_cv) || 0) * 0.10
            ) * 33.33;

            // Use REDCap summary if available and non-zero, otherwise use calculated
            const totalScorePct = (record.summary && parseFloat(record.summary) > 0)
                ? parseFloat(record.summary)
                : calculatedTotalPct;

            grouped[candidateName].push({
                originalEntry: record.candidate_names,
                reviewerName: record.reviewer_name || 'Unknown Reviewer',
                reviewerEmail: record.reviewer_email || '',
                reviewDate: record.review_date || '',
                problemClarity: parseFloat(record.bg_problem_clarity) || 0,
                justification: parseFloat(record.bg_justification) || 0,
                literature: parseFloat(record.bg_literature) || 0,
                rationale: parseFloat(record.bg_rationale) || 0,
                diversity: parseFloat(record.diversity) || 0,
                collab: parseFloat(record.collab) || 0,
                applicantCV: parseFloat(record.applicant_cv) || 0,
                proposalStrength: parseFloat(record.strength_of_the_proposal1) || 0,
                areasForImprovement: record.areas_for_improvement1 || '',
                finalRecommendation: record.final_recommendation1 || '',
                totalScore: parseFloat(record.format_total) || 0,
                // Calculated percentage fields
                innovationPct: parseFloat(innovationPct).toFixed(0),
                relevancePct: parseFloat(relevancePct).toFixed(0),
                feasibilityPct: parseFloat(feasibilityPct).toFixed(0),
                potentialPct: parseFloat(potentialPct).toFixed(0),
                diversityPct: parseFloat(diversityPct).toFixed(0),
                collabPct: parseFloat(collabPct).toFixed(0),
                cvPct: parseFloat(cvPct).toFixed(0),
                totalScorePct: parseFloat(totalScorePct).toFixed(0)
            });
        });

        setGroupedData(grouped);
    };

    // Calculate statistics
    const stats = useMemo(() => {
        const allReviews = Object.values(groupedData).flat();

        const total = Object.keys(groupedData).length;
        const totalReviews = allReviews.length;

        const recommendations = allReviews.reduce((acc, r) => {
            if (r.finalRecommendation === '1') acc.strong++;
            else if (r.finalRecommendation === '2') acc.regular++;
            else if (r.finalRecommendation === '3') acc.notRecommend++;
            return acc;
        }, { strong: 0, regular: 0, notRecommend: 0 });

        const avgScore = allReviews.length > 0
            ? (allReviews.reduce((sum, r) => sum + r.totalScore, 0) / allReviews.length).toFixed(1)
            : 0;

        const multipleReviewers = Object.values(groupedData).filter(reviews => reviews.length > 1).length;

        return { total, totalReviews, ...recommendations, avgScore, multipleReviewers };
    }, [groupedData]);

    // Filter data
    const filteredData = useMemo(() => {
        let filtered = { ...groupedData };

        if (selectedCandidate !== 'all') {
            filtered = { [selectedCandidate]: groupedData[selectedCandidate] };
        }

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const newFiltered = {};
            Object.keys(filtered).forEach(candidate => {
                const candidateMatch = candidate.toLowerCase().includes(search);
                const reviewerMatch = filtered[candidate].some(r =>
                    r.reviewerName.toLowerCase().includes(search)
                );
                if (candidateMatch || reviewerMatch) {
                    newFiltered[candidate] = filtered[candidate];
                }
            });
            filtered = newFiltered;
        }

        if (selectedRecommendation !== 'all') {
            const newFiltered = {};
            Object.keys(filtered).forEach(candidate => {
                const hasRec = filtered[candidate].some(r => {
                    if (selectedRecommendation === 'strong' && r.finalRecommendation === '1') return true;
                    if (selectedRecommendation === 'regular' && r.finalRecommendation === '2') return true;
                    if (selectedRecommendation === 'not' && r.finalRecommendation === '3') return true;
                    return false;
                });
                if (hasRec) newFiltered[candidate] = filtered[candidate];
            });
            filtered = newFiltered;
        }

        if (reviewCountFilter !== 'all') {
            const newFiltered = {};
            Object.keys(filtered).forEach(candidate => {
                const count = filtered[candidate].length;
                if (reviewCountFilter === 'multiple' && count > 1) {
                    newFiltered[candidate] = filtered[candidate];
                } else if (reviewCountFilter === 'single' && count === 1) {
                    newFiltered[candidate] = filtered[candidate];
                }
            });
            filtered = newFiltered;
        }

        return filtered;
    }, [groupedData, selectedCandidate, searchTerm, selectedRecommendation, reviewCountFilter]);

    // Chart data
    const scoreDistribution = useMemo(() => {
        const allReviews = Object.values(filteredData).flat();
        const ranges = { '0-7': 0, '8-14': 0, '15-18': 0, '19-21': 0 };

        allReviews.forEach(r => {
            if (r.totalScore <= 7) ranges['0-7']++;
            else if (r.totalScore <= 14) ranges['8-14']++;
            else if (r.totalScore <= 18) ranges['15-18']++;
            else ranges['19-21']++;
        });

        return Object.entries(ranges).map(([name, value]) => ({ name, value }));
    }, [filteredData]);

    const recommendationData = useMemo(() => {
        const allReviews = Object.values(filteredData).flat();
        const counts = allReviews.reduce((acc, r) => {
            if (r.finalRecommendation === '1') acc['Strongly Recommend'] = (acc['Strongly Recommend'] || 0) + 1;
            else if (r.finalRecommendation === '2') acc['Recommend'] = (acc['Recommend'] || 0) + 1;
            else if (r.finalRecommendation === '3') acc['Do Not Recommend'] = (acc['Do Not Recommend'] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredData]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

    // Export to Excel
    const exportToExcel = async () => {
        try {
            const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs');

            const exportData = [];

            Object.keys(groupedData).sort().forEach(candidate => {
                const reviews = groupedData[candidate];

                // Add all reviews for this candidate
                reviews.forEach((review, index) => {
                    const researchTotal = review.problemClarity + review.justification +
                        review.literature + review.rationale + review.diversity + review.collab;

                    const recText = review.finalRecommendation === '1' ? 'Strongly Recommend' :
                        review.finalRecommendation === '2' ? 'Recommend' :
                            review.finalRecommendation === '3' ? 'Do Not Recommend' : 'Not Specified';

                    // Parse HTML for Excel export
                    const parsedImprovement = parseHTML(review.areasForImprovement) || 'None specified';

                    exportData.push({
                        'Candidate Name': candidate,
                        'Reviewer #': index + 1,
                        'Reviewer Name': review.reviewerName,
                        'Reviewer Email': review.reviewerEmail,
                        'Review Date': review.reviewDate,
                        'Innovation & Originality': review.problemClarity,
                        'Innovation %': review.innovationPct + '%',
                        'Relevance': review.justification,
                        'Relevance %': review.relevancePct + '%',
                        'Feasibility': review.literature,
                        'Feasibility %': review.feasibilityPct + '%',
                        'Applicant Potential': review.rationale,
                        'Potential %': review.potentialPct + '%',
                        'Diversity & Inclusion': review.diversity,
                        'Diversity %': review.diversityPct + '%',
                        'Collaboration': review.collab,
                        'Collaboration %': review.collabPct + '%',
                        'Applicant CV': review.applicantCV,
                        'CV %': review.cvPct + '%',
                        'Proposal Strength': review.proposalStrength,
                        'Research Subtotal': researchTotal.toFixed(1),
                        'Total Score': review.totalScore,
                        'Total Score %': review.totalScorePct + '%',
                        'Final Recommendation': recText,
                        'Areas for Improvement': parsedImprovement
                    });
                });

                // Calculate averages for this candidate
                const avgInnovation = (reviews.reduce((sum, r) => sum + r.problemClarity, 0) / reviews.length).toFixed(1);
                const avgRelevance = (reviews.reduce((sum, r) => sum + r.justification, 0) / reviews.length).toFixed(1);
                const avgFeasibility = (reviews.reduce((sum, r) => sum + r.literature, 0) / reviews.length).toFixed(1);
                const avgPotential = (reviews.reduce((sum, r) => sum + r.rationale, 0) / reviews.length).toFixed(1);
                const avgDiversity = (reviews.reduce((sum, r) => sum + r.diversity, 0) / reviews.length).toFixed(1);
                const avgCollab = (reviews.reduce((sum, r) => sum + r.collab, 0) / reviews.length).toFixed(1);
                const avgCV = (reviews.reduce((sum, r) => sum + r.applicantCV, 0) / reviews.length).toFixed(1);
                const avgProposalStrength = (reviews.reduce((sum, r) => sum + r.proposalStrength, 0) / reviews.length).toFixed(1);
                const avgTotalScore = (reviews.reduce((sum, r) => sum + r.totalScore, 0) / reviews.length).toFixed(1);
                const avgTotalScorePct = (reviews.reduce((sum, r) => sum + parseFloat(r.totalScorePct), 0) / reviews.length).toFixed(0);

                const avgInnovationPct = ((avgInnovation / 3) * 100).toFixed(0);
                const avgRelevancePct = ((avgRelevance / 3) * 100).toFixed(0);
                const avgFeasibilityPct = ((avgFeasibility / 3) * 100).toFixed(0);
                const avgPotentialPct = ((avgPotential / 3) * 100).toFixed(0);
                const avgDiversityPct = ((avgDiversity / 3) * 100).toFixed(0);
                const avgCollabPct = ((avgCollab / 3) * 100).toFixed(0);
                const avgCVPct = ((avgCV / 3) * 100).toFixed(0);

                const avgResearchTotal = (parseFloat(avgInnovation) + parseFloat(avgRelevance) +
                    parseFloat(avgFeasibility) + parseFloat(avgPotential) +
                    parseFloat(avgDiversity) + parseFloat(avgCollab)).toFixed(1);

                // Add average row
                exportData.push({
                    'Candidate Name': candidate,
                    'Reviewer #': 'AVERAGE',
                    'Reviewer Name': '',
                    'Reviewer Email': '',
                    'Review Date': '',
                    'Innovation & Originality': avgInnovation,
                    'Innovation %': avgInnovationPct + '%',
                    'Relevance': avgRelevance,
                    'Relevance %': avgRelevancePct + '%',
                    'Feasibility': avgFeasibility,
                    'Feasibility %': avgFeasibilityPct + '%',
                    'Applicant Potential': avgPotential,
                    'Potential %': avgPotentialPct + '%',
                    'Diversity & Inclusion': avgDiversity,
                    'Diversity %': avgDiversityPct + '%',
                    'Collaboration': avgCollab,
                    'Collaboration %': avgCollabPct + '%',
                    'Applicant CV': avgCV,
                    'CV %': avgCVPct + '%',
                    'Proposal Strength': avgProposalStrength,
                    'Research Subtotal': avgResearchTotal,
                    'Total Score': avgTotalScore,
                    'Total Score %': avgTotalScorePct + '%',
                    'Final Recommendation': '',
                    'Areas for Improvement': ''
                });
            });

            const ws = XLSX.utils.json_to_sheet(exportData);

            // Set column widths
            ws['!cols'] = [
                { wch: 30 }, // Candidate Name
                { wch: 10 }, // Reviewer #
                { wch: 25 }, // Reviewer Name
                { wch: 30 }, // Reviewer Email
                { wch: 15 }, // Review Date
                { wch: 12 }, // Innovation
                { wch: 10 }, // Innovation %
                { wch: 12 }, // Relevance
                { wch: 10 }, // Relevance %
                { wch: 12 }, // Feasibility
                { wch: 10 }, // Feasibility %
                { wch: 12 }, // Applicant Potential
                { wch: 10 }, // Potential %
                { wch: 12 }, // Diversity
                { wch: 10 }, // Diversity %
                { wch: 12 }, // Collaboration
                { wch: 10 }, // Collaboration %
                { wch: 12 }, // Applicant CV
                { wch: 10 }, // CV %
                { wch: 12 }, // Proposal Strength
                { wch: 12 }, // Research Subtotal
                { wch: 12 }, // Total Score
                { wch: 12 }, // Total Score %
                { wch: 20 }, // Final Recommendation
                { wch: 60 }  // Areas for Improvement
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'reviewer_assignments');

            XLSX.writeFile(wb, `ARSH_Fellows_Reviews_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting data. Please try again.');
        }
    };

    const getRecommendationBadge = (rec) => {
        if (rec === '1') return { text: 'Strongly Recommend', class: 'bg-emerald-100 text-emerald-800' };
        if (rec === '2') return { text: 'Recommend', class: 'bg-blue-100 text-blue-800' };
        if (rec === '3') return { text: 'Do Not Recommend', class: 'bg-red-100 text-red-800' };
        return { text: 'Not Specified', class: 'bg-gray-100 text-gray-800' };
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-8">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-green-700 bg-clip-text text-transparent">
                                ARSH Fellows Proposal Reviews
                            </h1>
                            <p className="text-gray-600 mt-2">Comprehensive Review Dashboard - PID: 112</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? 'Fetching...' : 'Fetch Reviews'}
                            </button>
                            {Object.keys(groupedData).length > 0 && (
                                <button
                                    onClick={exportToExcel}
                                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
                                >
                                    <Download className="w-5 h-5" />
                                    Export to Excel
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-xl">
                        <p className="font-medium">{error}</p>
                    </div>
                )}

                {/* Stats Cards */}
                {Object.keys(groupedData).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium mb-1">Total Candidates</p>
                                    <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
                                </div>
                                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Users className="w-7 h-7 text-blue-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium mb-1">Total Reviews</p>
                                    <p className="text-4xl font-bold text-gray-900">{stats.totalReviews}</p>
                                </div>
                                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                                    <FileText className="w-7 h-7 text-green-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium mb-1">Strongly Recommended</p>
                                    <p className="text-4xl font-bold text-gray-900">{stats.strong}</p>
                                </div>
                                <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
                                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium mb-1">Avg Score</p>
                                    <p className="text-4xl font-bold text-gray-900">{stats.avgScore}<span className="text-xl text-gray-500">/21</span></p>
                                </div>
                                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <AlertCircle className="w-7 h-7 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Charts */}
                {Object.keys(groupedData).length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Score Distribution</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={scoreDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '14px' }} />
                                    <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recommendations Breakdown</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={recommendationData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={90}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {recommendationData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Weighted Scoring Explanation */}
                {/*{Object.keys(groupedData).length > 0 && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md border-2 border-blue-200 p-6">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-blue-900 mb-3">Understanding Total Score Percentages</h3>
                                <p className="text-blue-800 mb-4">
                                    Two candidates with the same total score (e.g., 20/21) may have <span className="font-semibold">different percentage scores</span> because
                                    each criterion is <span className="font-semibold">weighted differently</span> based on its importance to the program.
                                </p>
                                <div className="bg-white rounded-lg p-4 mb-3">
                                    <h4 className="font-semibold text-blue-900 mb-2">Criterion Weights:</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-gray-700"><span className="font-semibold">Innovation:</span> 23%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-gray-700"><span className="font-semibold">Relevance:</span> 18%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-gray-700"><span className="font-semibold">Feasibility:</span> 18%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-gray-700"><span className="font-semibold">Potential:</span> 13%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                            <span className="text-gray-700"><span className="font-semibold">CV Quality:</span> 10%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                            <span className="text-gray-700"><span className="font-semibold">Diversity:</span> 9%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                            <span className="text-gray-700"><span className="font-semibold">Collaboration:</span> 9%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-blue-100 rounded-lg p-4 border border-blue-300">
                                    <p className="text-sm text-blue-900">
                                        <span className="font-semibold">Example:</span> Losing 1 point in <span className="font-semibold">Feasibility (18% weight)</span> has
                                        a bigger impact on the total percentage (~6% reduction) than losing 1 point in <span className="font-semibold">Collaboration (9% weight)</span> (~3% reduction).
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
*/}
                {/* Filters */}
                {Object.keys(groupedData).length > 0 && (
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-5 h-5 text-gray-600" />
                            <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="relative">
                                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search candidates or reviewers..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                />
                            </div>

                            <select
                                value={selectedCandidate}
                                onChange={(e) => setSelectedCandidate(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                <option value="all">All Candidates</option>
                                {Object.keys(groupedData).sort().map(c => (
                                    <option key={c} value={c}>{c} ({groupedData[c].length})</option>
                                ))}
                            </select>

                            <select
                                value={selectedRecommendation}
                                onChange={(e) => setSelectedRecommendation(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                <option value="all">All Recommendations</option>
                                <option value="strong">Strongly Recommend</option>
                                <option value="regular">Recommend</option>
                                <option value="not">Do Not Recommend</option>
                            </select>

                            <select
                                value={reviewCountFilter}
                                onChange={(e) => setReviewCountFilter(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                <option value="all">All Review Counts</option>
                                <option value="multiple">Multiple Reviewers</option>
                                <option value="single">Single Reviewer</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Reviews Table */}
                {Object.keys(filteredData).length > 0 && (
                    <div className="space-y-6">
                        {Object.keys(filteredData).sort().map(candidate => {
                            const reviews = filteredData[candidate];
                            const recCounts = reviews.reduce((acc, r) => {
                                if (r.finalRecommendation === '1') acc.strong++;
                                else if (r.finalRecommendation === '2') acc.regular++;
                                else if (r.finalRecommendation === '3') acc.not++;
                                return acc;
                            }, { strong: 0, regular: 0, not: 0 });

                            return (
                                <div key={candidate} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4">
                                        <h3 className="text-2xl font-bold text-white mb-2">{candidate}</h3>
                                        <div className="flex gap-4 flex-wrap">
                      <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                        📊 {reviews.length} Review{reviews.length > 1 ? 's' : ''}
                      </span>
                                            <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                        ✅ Strong: {recCounts.strong}
                      </span>
                                            <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                        👍 Regular: {recCounts.regular}
                      </span>
                                            <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                        ❌ Not: {recCounts.not}
                      </span>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b-2 border-emerald-200">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Reviewer</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Scores</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Total</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Recommendation</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Improvements</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                            {reviews.map((review, idx) => {
                                                const badge = getRecommendationBadge(review.finalRecommendation);
                                                return (
                                                    <tr key={idx} className="hover:bg-emerald-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full font-semibold text-sm">
                                  {idx + 1}
                                </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-gray-900">{review.reviewerName}</div>
                                                            <div className="text-sm text-gray-500">{review.reviewerEmail}</div>
                                                            {review.originalEntry !== candidate && (
                                                                <div className="text-xs text-amber-600 mt-1">
                                                                    Originally entered as: {review.originalEntry}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{review.reviewDate || 'N/A'}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="space-y-2">
                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                    <div className="bg-blue-50 p-2 rounded">
                                                                        <div className="font-medium text-blue-900">Innovation: {review.problemClarity}</div>
                                                                        <div className="text-xs text-blue-600">({review.innovationPct}%)</div>
                                                                        <div className="text-blue-700">Relevance: {review.justification}</div>
                                                                        <div className="text-xs text-blue-600">({review.relevancePct}%)</div>
                                                                        <div className="text-blue-700">Feasibility: {review.literature}</div>
                                                                        <div className="text-xs text-blue-600">({review.feasibilityPct}%)</div>
                                                                    </div>
                                                                    <div className="bg-purple-50 p-2 rounded">
                                                                        <div className="font-medium text-purple-900">Potential: {review.rationale}</div>
                                                                        <div className="text-xs text-purple-600">({review.potentialPct}%)</div>
                                                                        <div className="text-purple-700">Collaboration: {review.collab}</div>
                                                                        <div className="text-xs text-purple-600">({review.collabPct}%)</div>
                                                                        <div className="text-purple-700">CV Quality: {review.applicantCV}</div>
                                                                        <div className="text-xs text-purple-600">({review.cvPct}%)</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-center">
                                                                <div className="text-3xl font-bold text-emerald-600">{review.totalScore}</div>
                                                                <div className="text-xs text-gray-500">out of 21</div>
                                                                <div className="mt-2 text-lg font-semibold text-emerald-700">
                                                                    {(() => {
                                                                        // Fallback calculation if totalScorePct is 0 or missing
                                                                        const displayPct = review.totalScorePct && parseFloat(review.totalScorePct) > 0
                                                                            ? parseFloat(review.totalScorePct)
                                                                            : (
                                                                            (review.problemClarity * 0.23) +
                                                                            (review.justification * 0.18) +
                                                                            (review.literature * 0.18) +
                                                                            (review.rationale * 0.13) +
                                                                            (review.diversity * 0.09) +
                                                                            (review.collab * 0.09) +
                                                                            (review.applicantCV * 0.10)
                                                                        ) * 33.33;
                                                                        return displayPct.toFixed(0);
                                                                    })()}%
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${badge.class}`}>
                                  {badge.text}
                                </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button
                                                                onClick={() => openImprovementModal(candidate, review.reviewerName, review.areasForImprovement)}
                                                                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm underline decoration-dotted hover:decoration-solid transition-all"
                                                            >
                                                                View Comments
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Average Row */}
                                            {reviews.length > 1 && (() => {
                                                const avgInnovation = (reviews.reduce((sum, r) => sum + r.problemClarity, 0) / reviews.length).toFixed(1);
                                                const avgRelevance = (reviews.reduce((sum, r) => sum + r.justification, 0) / reviews.length).toFixed(1);
                                                const avgFeasibility = (reviews.reduce((sum, r) => sum + r.literature, 0) / reviews.length).toFixed(1);
                                                const avgPotential = (reviews.reduce((sum, r) => sum + r.rationale, 0) / reviews.length).toFixed(1);
                                                const avgDiversity = (reviews.reduce((sum, r) => sum + r.diversity, 0) / reviews.length).toFixed(1);
                                                const avgCollab = (reviews.reduce((sum, r) => sum + r.collab, 0) / reviews.length).toFixed(1);
                                                const avgCV = (reviews.reduce((sum, r) => sum + r.applicantCV, 0) / reviews.length).toFixed(1);
                                                const avgTotalScore = (reviews.reduce((sum, r) => sum + r.totalScore, 0) / reviews.length).toFixed(1);
                                                const avgTotalScorePct = (reviews.reduce((sum, r) => sum + parseFloat(r.totalScorePct), 0) / reviews.length).toFixed(0);

                                                const avgInnovationPct = ((avgInnovation / 3) * 100).toFixed(0);
                                                const avgRelevancePct = ((avgRelevance / 3) * 100).toFixed(0);
                                                const avgFeasibilityPct = ((avgFeasibility / 3) * 100).toFixed(0);
                                                const avgPotentialPct = ((avgPotential / 3) * 100).toFixed(0);
                                                const avgDiversityPct = ((avgDiversity / 3) * 100).toFixed(0);
                                                const avgCollabPct = ((avgCollab / 3) * 100).toFixed(0);
                                                const avgCVPct = ((avgCV / 3) * 100).toFixed(0);

                                                return (
                                                    <tr className="bg-gradient-to-r from-amber-50 to-yellow-50 border-t-2 border-amber-300 font-semibold">
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center justify-center w-8 h-8 bg-amber-200 text-amber-800 rounded-full font-bold text-xs">
                                                                AVG
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-amber-900 text-lg">Average Scores</div>
                                                            <div className="text-sm text-amber-700">Across {reviews.length} reviews</div>
                                                        </td>
                                                        <td className="px-6 py-4"></td>
                                                        <td className="px-6 py-4">
                                                            <div className="space-y-2">
                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                    <div className="bg-blue-100 p-2 rounded border border-blue-300">
                                                                        <div className="font-bold text-blue-900">Innovation: {avgInnovation}</div>
                                                                        <div className="text-xs text-blue-700">({avgInnovationPct}%)</div>
                                                                        <div className="text-blue-800 font-semibold">Relevance: {avgRelevance}</div>
                                                                        <div className="text-xs text-blue-700">({avgRelevancePct}%)</div>
                                                                        <div className="text-blue-800 font-semibold">Feasibility: {avgFeasibility}</div>
                                                                        <div className="text-xs text-blue-700">({avgFeasibilityPct}%)</div>
                                                                    </div>
                                                                    <div className="bg-purple-100 p-2 rounded border border-purple-300">
                                                                        <div className="font-bold text-purple-900">Potential: {avgPotential}</div>
                                                                        <div className="text-xs text-purple-700">({avgPotentialPct}%)</div>
                                                                        <div className="text-purple-800 font-semibold">Collaboration: {avgCollab}</div>
                                                                        <div className="text-xs text-purple-700">({avgCollabPct}%)</div>
                                                                        <div className="text-purple-800 font-semibold">CV Quality: {avgCV}</div>
                                                                        <div className="text-xs text-purple-700">({avgCVPct}%)</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-center">
                                                                <div className="text-3xl font-bold text-amber-700">{avgTotalScore}</div>
                                                                <div className="text-xs text-amber-600">out of 21</div>
                                                                <div className="mt-2 text-lg font-bold text-amber-800">
                                                                    {avgTotalScorePct}%
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4"></td>
                                                        <td className="px-6 py-4"></td>
                                                    </tr>
                                                );
                                            })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Improvement Modal */}
                {improvementModal.open && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={closeImprovementModal}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Areas for Improvement</h3>
                                        <p className="text-emerald-100 mt-1">{improvementModal.candidate}</p>
                                    </div>
                                    <button
                                        onClick={closeImprovementModal}
                                        className="text-white hover:text-emerald-100 transition-colors"
                                    >
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-emerald-50 text-sm mt-2">
                                    Reviewer: <span className="font-medium">{improvementModal.reviewer}</span>
                                </p>
                            </div>

                            <div className="px-6 py-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                                <div className="prose prose-emerald max-w-none">
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                                        {improvementModal.text}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
                                <button
                                    onClick={closeImprovementModal}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && Object.keys(groupedData).length === 0 && (
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Yet</h3>
                        <p className="text-gray-600 mb-6">Click "Fetch Reviews" to load data from REDCap</p>
                    </div>
                )}

                {/* No Results After Filter */}
                {!loading && Object.keys(groupedData).length > 0 && Object.keys(filteredData).length === 0 && (
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-10 h-10 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Results Found</h3>
                        <p className="text-gray-600 mb-6">Try adjusting your filters</p>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCandidate('all');
                                setSelectedRecommendation('all');
                                setReviewCountFilter('all');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ProposalsReviewDashboard;