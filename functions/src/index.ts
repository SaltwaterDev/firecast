import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import "firebase-functions";
admin.initializeApp();

import axios from "axios";


// Listen for changes in all documents in the 'users' collection
exports.scoreComment = functions.firestore
    .document("posts/{postId}/comments/{commentId}")
    .onWrite((change, context) => {
      // Retrieve the current and previous value
      const comment = change.after.data();
      const previousData = change.before.data();
      const ref = change.after.ref;
      const postRef = ref.parent.parent;
      if (postRef == null) {
        return;
      }

      return postRef.get().then((parentSnap) => {
        const post = parentSnap.data();
        const postContent = post?.journal;

        // We'll only update if the name has changed.
        // This is crucial to prevent infinite loops.
        const commentContent = comment?.content
        if (commentContent == previousData?.content) {
          return null;
        }
        console.log("commentContent: "+commentContent);
        console.log("postContent: "+postContent);


        return axios({
          method: "post",
          url: "http://35.188.42.222:8501/v1/models/reddit_electra_small:predict",
          data: {"inputs": {
            "sentence1": [postContent],
            "sentence2": [commentContent],
          }}
        }).then((response) => {
          console.log("response data: "+JSON.stringify(response.data));
          const result = JSON.parse(JSON.stringify(response.data));
          console.log("outputs: "+result.outputs);
          const newScore = parseFloat(result.outputs[0][0])
          console.log("new score: "+newScore);
          change.after.ref.update({
            score: newScore,
          });
        }, (error) => {
          console.log(error);
        });
      });
    });


/**
 * Triggers when a user receive a new comment and sends a notification.
 * Followers add a flag to `/posts/{postID}/comment/{commentID}`.
 */
const db = admin.firestore();

exports.sendCommentNotification = functions.firestore
  .document("posts/{postID}/comments/{commentID}")
  .onWrite((change, context) => {
    const postID = context.params.postID;
    const comment = change.after.data();
    const commentID = context.params.commentID;
    const uid = comment?.uid;
   
    if (comment?.content == change.before.data()?.content) {
      return null;
    }
    console.log(
      "We have a new comment:"+commentID+
      "for post:"+postID
    );

    const postRef = change.after.ref.parent.parent;
    return postRef?.get().then((parentSnap) => {
      const post = parentSnap.data();
      const writerUid = post?.author_uid;

      console.log(
        "comment uid: "+uid+
        "post uid: "+writerUid
      );
  
      // Dont send notification if it is the writer who send the comment
      if (uid == writerUid){
        return null
      }

      // Get the device notification tokens.
      return db.doc("users/"+uid).get().then((userSnap) => {
        const user = userSnap.data();
        const notificationToken = user?.notificationToken;

        // create notification
        const message = {
          data: {
            pid: postID,
            title: "You receive a new response!",
            body: "Click me to view the response from your post"
          },
          token: notificationToken
        };
        
        // Send a message to the device corresponding to the provided
        // registration token.
        admin.messaging().send(message)
          .then((response) => {
            // Response is a message ID string.
            console.log("Successfully sent message:", response);
          })
          .catch((error) => {
            console.log("Error sending message:", error);
          });
      });
    });
 });

// Validate the school email. This function can only validate universities/colleges in hk and some sec. schools using "@gmail.edu.hk" 
exports.validateSchoolEmail = functions.https.onCall(async (data) => {
  // Grab the text parameter.
  const email = data.text;
  console.log("receiving text:", email);
  if (typeof email === "string"){
    const domain = email.substring(email.lastIndexOf("@") +1);
    // create the list of validated school domain
    const schoolDomains = ["connect.hku.hk", "connect.ust.hk", "s.eduhk.hk",
    "connect.polyu.hk", "link.cuhk.edu.hk", "my.cityu.edu.hk", "life.hkbu.edu.hk",
    "study.ouhk.edu.hk", "hsu.edu.hk", "alumni.hksyu.edu.hk", "hksyu.edu.hk",
    "student.hkcc-polyu.edu.hk", "learner.hkuspace.hku.hk", "stu.vtc.edu.hk",
    "gmail.edu.hk", "ln.hk"]

    if (schoolDomains.includes(domain)){
      console.log("validation:", "true");
      return {validation: "true"};
    }
    if (email == "yannylo123123@gmail.com"){
      console.log("validation:", "true");
      return {validation: "true"};
    }
    console.log("validation:", "false");
    return {validation: "false"};
  }
  console.log("validation:", "error");
  return {validation: "error: receiving text is: "+email};
});


exports.updateLabel = functions.firestore
    .document("posts/{postId}")
    .onCreate((snap, context) => {
      // Get an object representing the document
      // e.g. {'author_uid': 'i73b5yr897y', 'content': "xxx", ...}
      const newPostValue = snap.data();

      // access a labels field
      const labels: Array<string> = newPostValue.labels;
      const labelRef = db.collection("categories").doc("self_made_labels");
      console.log("labels: ", labels)
  
      return labelRef.get().then(async (snap) => {
      // union with new label(s) to the "list" array field.
      for(const label of labels){
        const unionRes = await labelRef.update({
          list: admin.firestore.FieldValue.arrayUnion(label)
        });
      }
    });
  });