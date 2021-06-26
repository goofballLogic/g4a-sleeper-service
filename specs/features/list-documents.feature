Feature: List documents
    As a caller
    I want to be able to list accessible documents
    So that I can select one to work with

    Scenario: User in the owning tenant can see tenant's documents
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        And TenantA has an "grant" document named "User A's document" created by UserA
        When UserA lists documents in TenantA
        Then the list contains the documents
            | name              |
            | User B's document |
            | User A's document |

    Scenario: A user who isn't in the owning tenant can not see tenant's documents
        Given user UserA exists in TenantA
        And user UserB exists in TenantB
        And TenantA has a "grant" document named "User B's document" created by UserB
        And TenantA has an "grant" document named "User A's document" created by UserA
        When UserB lists documents in TenantA
        Then the list is empty

# Scenario: Even the author who isn't in the owning tenancy can not access their document directly
#     Given user UserA exists in TenantA
#     And user UserB exists in TenantB
#     And TenantA has a "grant" document named "User B's document" created by UserB
#     When UserB tries to access the document "User B's document"
#     Then the request to access the document fails

# Scenario: But - the author of a document can access it as the author
#     Given user UserA exists in TenantA
#     And user UserB exists in TenantB
#     And TenantA has a "grant" document named "User B's document" created by UserB
#     When UserB tries to access the document "User B's document" as the author
#     Then the request to access the document succeeds

# Scenario: Any other user (even in the owning tenant) can't access the document as the author
#     Given user UserA exists in TenantA
#     And user UserB exists in TenantB
#     And TenantA has a "grant" document named "User B's document" created by UserB
#     When UserA tries to access the document "User B's document" as the author
#     Then the request to access the document fails

# Scenario: A public document can be viewed by anyone
#     Given user UserA exists in TenantA
#     And user UserB exists in TenantB
#     Given TenantA has a public "grant" document named "User A's public document" created by UserA
#     When UserB tries to access the public document "User A's public document"
#     Then the request to access the document succeeds

# Scenario: But - a document which isn't public can't be viewed as though it were public
#     Given user UserA exists in TenantA
#     And user UserB exists in TenantB
#     Given TenantA has a "grant" document named "User A's document" created by UserA
#     When UserB tries to access the public document "User A's document"
#     Then the request to access the document fails
