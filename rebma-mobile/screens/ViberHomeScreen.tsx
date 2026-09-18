// rebma-mobile/screens/ViberHomeScreen.tsx
//
// The Viber tab's landing screen. Viber opens straight into Chats — this
// IS the real Messenger (MessengerChannelsScreen), unchanged. Boardroom
// (Live Video Minutes / Announcements / Direct Messages / Meetings) is a
// feature reachable FROM Chats, not an equal alternate view — its button
// now sits inline beside the search bar (MessengerChannelsScreen's
// `onOpenBoardroom` prop), not on its own row above everything else. It
// still just pushes into BoardroomHome, same as tapping into any other
// screen — it never replaces Chats.
import MessengerChannelsScreen from './MessengerChannelsScreen';

export default function ViberHomeScreen({ navigation }: any) {
  return (
    <MessengerChannelsScreen navigation={navigation} onOpenBoardroom={() => navigation.navigate('BoardroomHome')} />
  );
}
