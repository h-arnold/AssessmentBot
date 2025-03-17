// ClassroomApiClient.js

/**
 * Handles operations related to Google Classroom entities.
 * 
 * @class ClassroomApiClient
 * This class is responsible solely for direct interactions with the Google Classroom API:
 * creating, updating, and fetching courses, and inviting teachers.
 */
class ClassroomApiClient {
    /**
     * Creates a new Google Classroom.
     * @param {string} name - The name of the classroom.
     * @param {string} ownerId - The email of the owner teacher.
     * @param {Array<string>} teacherEmails - The emails of additional teachers.
     * @returns {GoogleAppsScript.Classroom.Schema.Course} The created course object.
     */
    static createClassroom(name, ownerId, teacherEmails = []) {
        try {
            const course = {
                name: name,
                ownerId: ownerId,
                courseState: 'ACTIVE'
            };
            const newCourse = Classroom.Courses.create(course);
            console.log(`Created Classroom: ${name} (${newCourse.id})`);

            // Invite additional teachers
            teacherEmails.forEach(email => {
                if (email !== ownerId) { // Avoid inviting the owner again
                    this.inviteTeacher(newCourse.id, email);
                }
            });

            return newCourse;
        } catch (error) {
            console.error(`Failed to create classroom '${name}': ${error.message}`);
            throw error;
        }
    }

    /**
     * Sends an invitation to a teacher to join a classroom.
     * @param {string} courseId - The ID of the classroom.
     * @param {string} teacherEmail - The email of the teacher to invite.
     */
    static inviteTeacher(courseId, teacherEmail) {
        try {
            // Check if the teacher is already part of the course
            const existingTeachers = Classroom.Courses.Teachers.list(courseId).teachers || [];
            const existingTeacherEmails = existingTeachers.map(teacher => teacher.profile.emailAddress);

            if (existingTeacherEmails.includes(teacherEmail)) {
                console.log(`Teacher ${teacherEmail} is already part of course ${courseId}. Skipping invitation.`);
                return;
            }

            const invitation = {
                courseId: courseId,
                role: 'TEACHER',
                userId: teacherEmail
            };
            Classroom.Invitations.create(invitation);
            console.log(`Sent invitation to teacher: ${teacherEmail} for course: ${courseId}`);
        } catch (error) {
            console.error(`Failed to invite teacher (${teacherEmail}) to course (${courseId}): ${error.message}`);
        }
    }

    /**
     * Updates an existing Google Classroom based on provided data.
     * @param {string} courseId - The ID of the classroom to update.
     * @param {string} newName - The new name for the classroom.
     * @param {string} newOwnerId - The new owner email, if changing owner.
     * @param {Array<string>} newTeacherEmails - The updated list of teacher emails.
     */
    static updateClassroom(courseId, newName, newOwnerId, newTeacherEmails = []) {
        try {
            const course = Classroom.Courses.get(courseId);

            // Update course name if changed
            if (course.name !== newName) {
                course.name = newName;
                Classroom.Courses.update(course, courseId);
                console.log(`Updated course name to '${newName}' for course ID: ${courseId}`);
            }

            // Update owner if changed
            if (newOwnerId && course.ownerId !== newOwnerId) {
                course.ownerId = newOwnerId;
                Classroom.Courses.update(course, courseId);
                console.log(`Updated course owner to '${newOwnerId}' for course ID: ${courseId}`);
            }

            // Get existing teachers
            const existingTeachers = Classroom.Courses.Teachers.list(courseId).teachers || [];
            const existingTeacherEmails = existingTeachers.map(teacher => teacher.profile.emailAddress);

            // Invite new teachers who are not already teachers
            newTeacherEmails.forEach(email => {
                if (email !== newOwnerId && !existingTeacherEmails.includes(email)) {
                    this.inviteTeacher(courseId, email);
                }
            });

            console.log(`Updated classroom (${courseId}) successfully.`);
        } catch (error) {
            console.error(`Failed to update classroom (${courseId}): ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetches all classrooms where the user is a teacher.
     * @returns {Array<GoogleAppsScript.Classroom.Schema.Course>} An array of classroom objects.
     */
    static fetchClassrooms() {
        try {
            const response = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] });
            const courses = response.courses || [];
            console.log(`Fetched ${courses.length} classrooms.`);
            return courses;
        } catch (error) {
            console.error(`Failed to fetch classrooms: ${error.message}`);
            throw error;
        }
    }
}
