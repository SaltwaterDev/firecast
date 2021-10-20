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
          url: "http://34.122.182.235:8501/v1/models/reddit_electra_small:predict",
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

    // Get the device notification tokens.
    return db.doc("users/"+uid).get().then((userSnap) => {
      const user = userSnap.data();
      const notificationToken = user?.notificationToken;

      // create notification
      const message = {
        notification: {
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