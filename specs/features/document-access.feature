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

    Scenario: A user who isn't in the owning tenant can not fetch a document
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And user UserC exists in TenantC
        And TenantA has a "grant" document named "User B's document" created by UserB
        When UserC tries to access the document "User B's document"
        Then the request to access the document fails

    Scenario: Even the author who isn't in the owning tenancy can not access their document directly
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        When UserB tries to access the document "User B's document"
        Then the request to access the document fails

    Scenario: But - the author of a document can access it as the author
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        When UserB tries to access the document "User B's document" as the author
        Then the request to access the document succeeds

    Scenario: Any other user (even in the owning tenant) can't access the document as the author
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        When UserA tries to access the document "User B's document" as the author
        Then the request to access the document fails

    Scenario: A public document can be viewed by anyone
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        Given TenantA has a public "grant" document named "User A's public document" created by UserA
        When UserB tries to access the public document "User A's public document"
        Then the request to access the document succeeds

    Scenario: But - a document which isn't public can't be viewed as though it were public
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        Given TenantA has a "grant" document named "User A's document" created by UserA
        When UserB tries to access the public document "User A's document"
        Then the request to access the document fails
