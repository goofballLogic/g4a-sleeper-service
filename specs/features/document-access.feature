Feature: Document access
    As a caller
    I want to be able to retrieve a document
    So that I can read it

    Scenario: User in the owning tenant can fetch a document
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        When UserA tries to access the document "User B's document"
        Then the request to access the document succeeds

    Scenario: The author can not access their document in a different tenancy directly
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        When UserB tries to access the document "User B's document"
        Then the request to access the document fails

    Scenario: The author of a document can access it as the author
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        When UserB tries to access the document "User B's document" as the author
        Then the request to access the document succeeds

    Scenario: A user who did not create the document can't access it as the author even if they are in the owning tenant
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        When UserA tries to access the document "User B's document" as the author
        Then the request to access the document fails

    Scenario: A public document can be viewed by anyone
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        Given TenantA has a public "grant" document named "User A's document" created by UserA
        When UserB tries to access the public document "User A's document"
        Then the request to access the document succeeds