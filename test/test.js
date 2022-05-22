const assert = require('assert')
const firebase = require('@firebase/testing')

const MY_PROJECT_ID = "unlone"
const myId = "PeVM0SJJRtHdmmYglC9wqzt7QDuI"
const theirId = "abc"
const myAuth = {uid: myId, email: "u3547727@connect.hku.hk"}

function getFirestore(auth) {
    return firebase.initializeTestApp({projectId: MY_PROJECT_ID, auth: auth}).firestore();
}

function getAdminFirestore() {
    return firebase.initializeAdminApp({projectId: MY_PROJECT_ID}).firestore();
}



beforeEach( async() => {
    await firebase.clearFirestoreData({projectId: MY_PROJECT_ID})
});

describe("unlone app", () => {
    it("Understanding basic addition", () => {
        assert.equal(2+2, 4);
    });


    
    it("Can read items in the 'users' collection", async() => {
        const admin = getAdminFirestore();
        const postId = "public_post";
        const setupDoc = admin.collection("users").doc(myId);
        await setupDoc.set({uid: myId})

        const db = getFirestore(myAuth);
        const testDoc = db.collection("users").doc(myId);
        await firebase.assertSucceeds(testDoc.get());
    });
    


    it("Can read items in the read-only collection 'posts'", async() => {
        const db = getFirestore(myAuth)
        const testDoc = db.collection("posts").doc("testDoc")
        await firebase.assertSucceeds(testDoc.get());
    });
    


    it("Can't delete items in the 'posts' collection if your ARN'T the writer", async() => {
        const admin = getAdminFirestore();
        const postId = "public_post";
        const setupDoc = admin.collection("posts").doc(postId);
        await setupDoc.set({author_uid: theirId});

        const db = getFirestore(myAuth);
        const testDoc = db.collection("posts").doc(postId);
        await firebase.assertFails(testDoc.delete());
    });



    it("Can write & delete items in the 'posts' collection if your are the writer", async() => {
        const db = getFirestore(myAuth);
        const setupDoc = db.collection("posts").doc("testDoc");
        await firebase.assertSucceeds(setupDoc.set({foo: "bar", author_uid: myId}));
        
        const testDoc = db.collection("posts").doc("testDoc");
        await firebase.assertSucceeds(testDoc.delete());
    });
})


after( async() => {
    await firebase.clearFirestoreData({projectId: MY_PROJECT_ID})
});