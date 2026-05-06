import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getOrCreateUserProfile, getAllUsers } from "../firebase";

export function useAuth() {
  const [authReady,     setAuthReady]     = useState(false);
  const [firebaseUser,  setFirebaseUser]  = useState(null);
  const [userProfile,   setUserProfile]   = useState(null);
  const [userProfiles,  setUserProfiles]  = useState({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminMode,     setAdminMode]     = useState(false);

  const isAdmin     = userProfile?.role === "admin";
  const isMonarch   = userProfile?.role === "monarch";
  // treat legacy "player" role as commander
  const isCommander = userProfile?.role === "commander" || userProfile?.role === "player";
  const isPlayer    = !!firebaseUser;
  // Admins only get elevated permissions when they have explicitly enabled admin mode
  const isAdminMode = isAdmin && adminMode;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await getOrCreateUserProfile(fbUser);
        setFirebaseUser(fbUser);
        setUserProfile(profile);
        setShowAuthModal(false);
      } else {
        setFirebaseUser(null);
        setUserProfile(null);
        setShowAuthModal(true);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isPlayer) return;
    getAllUsers().then(users => {
      const map = {};
      users.forEach(u => { map[u.uid] = u.displayName; });
      setUserProfiles(map);
    });
  }, [isPlayer]);

  const handleAuthSuccess = (fbUser, profile) => {
    setFirebaseUser(fbUser);
    setUserProfile(profile);
    setShowAuthModal(false);
  };

  return {
    authReady, firebaseUser, userProfile, setUserProfile,
    userProfiles, showAuthModal, setShowAuthModal,
    adminMode, setAdminMode,
    isAdmin, isMonarch, isCommander, isPlayer, isAdminMode,
    handleAuthSuccess,
  };
}
