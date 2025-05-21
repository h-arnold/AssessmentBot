A lot of the more advanced data analysis tools I want to create require that metadata is easier to find and handle than is currently available by extracting data from the Google Sheets.

Instead of creating increasingly complex and slow routines to extract the data from the sheets, I intend to create a series of json files that are linked to the different assessment records. They will need to be linked somehow to the Google Sheet - I'm thinking an index json object stored in each sheet's `DocumentProperties` may be a good solution, or potentially a centrally managed index that's held on the admin sheet's script properties.

This metadata manager class will need to do handle things like:

- Creating new metadata files if they don't exist.
- Updating metadata files if they do exist.
- Deleting metadata files if they are no longer needed.
- Reading metadata files to extract the data.
- Managing the index of metadata files to ensure that they are linked to the correct assessment records.

It will need to store things like:

- student details - name, email, userId, target grade etc.
- assessment details - name, associated template and reference documents, when it was created, last updated,

Non time-sensitive data - e.g. updating student records to remove names from students who are no longer in the class could be handled by a setting a time based trigger so that it doesn't impede the assessment process.

## Metadata heirarchy

### Admin sheet metadata

At the moment, I'm thinking that the metadata should have a 'master' index that stores references to either all of the metadata files in a serialised json object stored in a `ScriptProperty`.

The master index could potentially be gzipped to keep it under the 100kb file size limit.

It would look something like:

index {

adminSheetMetaData:
{
 adminSheetRelatedMetadatafiles: { the files}
}

### Main index of assignments to be shared

assignmentMetadata: {
    assignmentId: {
        topic: "Assignment 1",
        assignmentNames: ["assignmentName1", "assignmentName2"],
        referenceDocumentIds: [
            { referenceDocumentId: "1234567890", templateDocumentID: "Assignment 1", documentType: "SHEETS/SLIDES" },
        ]
    }
}

### Assessment Record Specific Assignment Metadata

NOTE: Try to structure this to enable for easy splitting of the metadata into separate files should a single file get too large.

``` json

assessmentRecordMetadata: {
    "documentId": "1234567890",
    "yearGroup": "Year 10",
    "ClassName": "10A",
    "gcCourseId": "1234567890",
    "assignments": {

"assignmentId": {

    "gcAssignmentId": "1234567890",
    "created": "2023-10-01",
    "lastUpdated": "2023-10-01",
    "lastAssessed": "2023-10-01",
    "assignmentType": "SHEETS/SLIDES",
    "sheetId": "1234567890",
    "assignmentObj": {
        assignmentObject that is generated during the assignment process goes here.
    }
}
}
