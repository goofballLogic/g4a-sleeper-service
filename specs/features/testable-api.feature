Feature: Testable API
    As a developer or user of the API
    I want to be able to call the API with test users
    So that I can carry out tests without using real login methods

    Scenario: Log in using TESTUSER bearer token with __testuser_User1
        When I call to initialize as user __testuser_User1
        Then the initialization call should have succeeded

    Scenario: Attempt to log in using TESTUSER bearer token with notATestUser
        When I call to initialize as user notATestUser
        Then the initialization call should have failed