Feature: Document access
    As a caller
    I want to be able to retrieve a document
    So that I can read it

    Background: A tenant exists with a document created by a user in another tenancy
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And user UserC exists in TenantC

    Scenario: User in the owning tenant can fetch a document
        Given TenantA has a "grant" document named "Document A" created by UserB
        When UserA tries to access the document "Document A"
        Then the request to access the document succeeds

    Scenario: The user who created the document can access it even if not in the owning tenant
        Given TenantA has a "grant" document named "Document B" created by UserB
        When UserB tries to access the document they created "Document B"
        Then the request to access the document succeeds

    Scenario: A public document can be viewed by other people
        Given TenantA has a public "grant" document named "Document C" created by UserA
        When UserC tries to access the public document "Document C"
        Then the request to access the document succeeds