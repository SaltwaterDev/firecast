import * as functions from "firebase-functions";

import admin = require("firebase-admin");
import axios from "axios";

admin.initializeApp();


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
