const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
    const MOODLE_URL = process.env.MOODLE_URL || 'https://soma.aphrc.org/uplms';
    const MOODLE_TOKEN = process.env.MOODLE_TOKEN;
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const FROM_EMAIL = 'virtualacademy@aphrc.org';

    try {
        const { userData } = JSON.parse(event.body);

        console.log('📝 Processing enrollment for:', userData.email_address);

        // Parse selected courses from REDCap
        // REDCap sends checkboxes as: selected_courses___221: "1", selected_courses___225: "1"
        const selectedCourses = [];
        for (const key in userData) {
            if (key.startsWith('selected_courses___') && userData[key] === '1') {
                const courseId = key.replace('selected_courses___', '');
                selectedCourses.push(courseId);
            }
        }

        console.log('📚 Selected courses:', selectedCourses);

        if (selectedCourses.length === 0) {
            console.log('⚠️ No courses selected');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: false,
                    message: 'No courses selected'
                })
            };
        }

        const tempPassword = generateSecurePassword();
        const username = userData.email_address.split('@')[0];

        console.log('🔑 Generated temporary password for user');

        // Create user in Moodle with force password change
        const createUserResponse = await fetch(
            `${MOODLE_URL}/webservice/rest/server.php`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    wstoken: MOODLE_TOKEN,
                    wsfunction: 'core_user_create_users',
                    moodlewsrestformat: 'json',
                    'users[0][username]': username,
                    'users[0][password]': tempPassword,
                    'users[0][firstname]': userData.first_name,
                    'users[0][lastname]': userData.last_name,
                    'users[0][email]': userData.email_address,
                    'users[0][auth]': 'manual',
                    'users[0][mailformat]': '1',
                    'users[0][maildisplay]': '2',
                    'users[0][preferences][0][type]': 'auth_forcepasswordchange',
                    'users[0][preferences][0][value]': '1',
                }),
            }
        );

        const createUserResult = await createUserResponse.json();
        console.log('User creation result:', createUserResult);

        let userId;
        let isNewUser = false;

        if (createUserResult[0] && createUserResult[0].id) {
            userId = createUserResult[0].id;
            isNewUser = true;
            console.log('✅ New user created with ID:', userId);
        } else if (createUserResult.exception) {
            console.log('User might exist, searching...');

            const getUserResponse = await fetch(
                `${MOODLE_URL}/webservice/rest/server.php`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        wstoken: MOODLE_TOKEN,
                        wsfunction: 'core_user_get_users_by_field',
                        moodlewsrestformat: 'json',
                        field: 'email',
                        'values[0]': userData.email_address,
                    }),
                }
            );

            const getUserResult = await getUserResponse.json();
            if (getUserResult[0]) {
                userId = getUserResult[0].id;
                console.log('✅ Found existing user with ID:', userId);
            } else {
                throw new Error('Could not create or find user');
            }
        } else {
            throw new Error('Unexpected response from user creation');
        }

        // Enroll user in ALL selected courses
        console.log('📚 Enrolling user in', selectedCourses.length, 'courses...');

        const enrollmentResults = [];
        for (const courseId of selectedCourses) {
            try {
                const enrollResponse = await fetch(
                    `${MOODLE_URL}/webservice/rest/server.php`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            wstoken: MOODLE_TOKEN,
                            wsfunction: 'enrol_manual_enrol_users',
                            moodlewsrestformat: 'json',
                            'enrolments[0][roleid]': 5,
                            'enrolments[0][userid]': userId,
                            'enrolments[0][courseid]': courseId,
                        }),
                    }
                );

                const enrollResult = await enrollResponse.json();
                console.log(`✅ Enrolled in course ${courseId}:`, enrollResult);
                enrollmentResults.push({ courseId, success: true });
            } catch (error) {
                console.error(`❌ Failed to enroll in course ${courseId}:`, error);
                enrollmentResults.push({ courseId, success: false, error: error.message });
            }
        }

        // Get course names for the email
        const courseNames = await getCourseNames(MOODLE_URL, MOODLE_TOKEN, selectedCourses);

        // Send email with SendGrid for NEW users
        let emailSent = false;
        if (isNewUser && SENDGRID_API_KEY && FROM_EMAIL) {
            console.log('📧 Sending welcome email with credentials via SendGrid...');

            sgMail.setApiKey(SENDGRID_API_KEY);

            // Build course list HTML
            const courseListHtml = courseNames.map(course =>
                `<li style="margin: 5px 0;">
                    <a href="${MOODLE_URL}/course/view.php?id=${course.id}" style="color: #007bff; text-decoration: none;">
                        ${course.name}
                    </a>
                </li>`
            ).join('');

            const courseListText = courseNames.map(course =>
                `- ${course.name} (${MOODLE_URL}/course/view.php?id=${course.id})`
            ).join('\n');

            const msg = {
                to: userData.email_address,
                from: {
                    email: FROM_EMAIL,
                    name: 'APHRC VLA'
                },
                subject: 'Welcome to the APHRC Virtual Learning Platform - Your Login Details',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h1 style="margin: 0;">Welcome to the APHRC VLA!</h1>
                    </div>
                    
                    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                        <h2>Hello ${userData.first_name} ${userData.last_name},</h2>
                        
                        <p>Congratulations! Your account has been successfully created on the APHRC Virtual Learning Platform (VLA).</p>
                        
                        <div style="background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #007bff;">📚 You're enrolled in ${selectedCourses.length} course${selectedCourses.length > 1 ? 's' : ''}:</h3>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                ${courseListHtml}
                            </ul>
                        </div>
                        
                        <div style="background: white; padding: 25px; border-radius: 5px; margin: 25px 0; border: 2px solid #007bff;">
                            <h3 style="margin-top: 0; color: #007bff;">Your Login Credentials</h3>
                            
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; color: #666;"><strong>Username:</strong></p>
                                <p style="margin: 5px 0;">
                                    <code style="background: #e9ecef; padding: 8px 15px; border-radius: 3px; font-weight: bold; font-size: 16px; display: inline-block;">${username}</code>
                                </p>
                            </div>
                            
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; color: #666;"><strong>Temporary Password:</strong></p>
                                <p style="margin: 5px 0;">
                                    <code style="background: #fff3cd; padding: 8px 15px; border-radius: 3px; font-weight: bold; font-size: 16px; display: inline-block; border: 1px solid #ffc107;">${tempPassword}</code>
                                </p>
                            </div>
                        </div>
                        
                        <div style="background: #d4edda; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;">
                            <p style="margin: 0; font-weight: bold; color: #155724;">✅ Ready to Login!</p>
                            <p style="margin: 10px 0 0 0; color: #155724;">Click the button below to login and start learning. You'll be prompted to create a new password on your first login for security.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://soma.aphrc.org/login" 
                               style="display: inline-block; background: #28a745; color: white; padding: 15px 40px; 
                                      text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                                Login Now
                            </a>
                        </div>
                        
                        <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px;"><strong>First Time Login Steps:</strong></p>
                            <ol style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
                                <li>Click "Login Now" button above</li>
                                <li>Enter your username and temporary password</li>
                                <li>You'll be asked to create a new permanent password</li>
                                <li>Access your courses from the dashboard</li>
                            </ol>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                            <p style="margin: 0; font-size: 13px;"><strong>⚠️ Security Note:</strong> For your security, you will be required to change this temporary password when you first login. Please choose a strong, unique password.</p>
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #666; font-size: 12px; text-align: center;">
                            Need help? Contact us at <a href="mailto:virtualacademy@aphrc.org">virtualacademy@aphrc.org</a>
                        </p>
                        
                        <p style="color: #999; font-size: 11px; text-align: center; margin-top: 20px;">
                            If you did not register for this account, please ignore this email and contact us immediately.
                        </p>
                    </div>
                </div>
            `,
                text: `
Welcome to APHRC Virtual Learning Platform!

Hello ${userData.first_name} ${userData.last_name},

Your account has been created successfully!

YOU'RE ENROLLED IN ${selectedCourses.length} COURSE${selectedCourses.length > 1 ? 'S' : ''}:
${courseListText}

YOUR LOGIN CREDENTIALS
====================
Username: ${username}
Temporary Password: ${tempPassword}

READY TO LOGIN!
Click here to login: https://soma.aphrc.org/login

FIRST TIME LOGIN STEPS:
1. Login with your username and temporary password
2. You'll be asked to create a new permanent password
3. Access your courses from the dashboard
4. Start learning!

SECURITY NOTE: For your security, you will be required to change this temporary password when you first login.

Need help? Contact us at virtualacademy@aphrc.org

If you did not register for this account, please ignore this email.
            `
            };

            try {
                await sgMail.send(msg);
                console.log('✅ Email with credentials sent successfully to:', userData.email_address);
                emailSent = true;
            } catch (error) {
                console.error('❌ SendGrid error:', error);
                if (error.response) {
                    console.error('SendGrid response body:', error.response.body);
                }
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                userId: userId,
                username: username,
                isNewUser: isNewUser,
                coursesEnrolled: enrollmentResults,
                emailSent: emailSent,
                message: `User enrolled in ${selectedCourses.length} course(s) successfully.`,
            }),
        };

    } catch (error) {
        console.error('❌ Enrollment error:', error);
        console.error('Error stack:', error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message
            }),
        };
    }
};

async function getCourseNames(moodleUrl, moodleToken, courseIds) {
    try {
        const response = await fetch(
            `${moodleUrl}/webservice/rest/server.php`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    wstoken: moodleToken,
                    wsfunction: 'core_course_get_courses',
                    moodlewsrestformat: 'json',
                }),
            }
        );

        const allCourses = await response.json();

        // Filter to only the courses the user selected
        return courseIds.map(courseId => {
            const course = allCourses.find(c => c.id.toString() === courseId.toString());
            return {
                id: courseId,
                name: course ? course.fullname : `Course ${courseId}`
            };
        });
    } catch (error) {
        console.error('Error fetching course names:', error);
        // Return basic info if fetch fails
        return courseIds.map(id => ({ id, name: `Course ${id}` }));
    }
}

function generateSecurePassword() {
    const adjectives = ['Swift', 'Bright', 'Bold', 'Sharp', 'Quick', 'Wise', 'Strong', 'Clear'];
    const nouns = ['Tiger', 'Eagle', 'River', 'Mountain', 'Ocean', 'Forest', 'Storm', 'Phoenix'];
    const numbers = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const symbols = '!@#$%';
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    return `${adjective}${noun}${numbers}${symbol}`;
}