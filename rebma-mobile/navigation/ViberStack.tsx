// rebma-mobile/navigation/ViberStack.tsx
//
// The Viber bottom tab's own stack. Viber opens straight into Chats
// (ViberHomeScreen = the real Messenger channel list). Boardroom is a
// feature reached FROM Chats, not an equal alternate view — see
// ViberHomeScreen.tsx's header comment — so it's a screen pushed on top
// (BoardroomHome), not a sibling default.
//   Chats:     ViberHome -> MessengerThread
//   Boardroom: ViberHome -> BoardroomHome -> VideoConf / Announcements /
//              DirectMessages / Meetings
// MessengerChannelsScreen's own `navigation.navigate('MessengerThread', ...)`
// calls resolve here since it's rendered as a child of ViberHome, which
// is itself registered in this same stack.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ViberHomeScreen from '../screens/ViberHomeScreen';
import BoardroomHomeScreen from '../screens/BoardroomHomeScreen';
import MessengerThreadScreen from '../screens/MessengerThreadScreen';
import VideoConfScreen from '../screens/boardroom/VideoConfScreen';
import AnnouncementsScreen from '../screens/boardroom/AnnouncementsScreen';
import DirectMessagesScreen from '../screens/boardroom/DirectMessagesScreen';
import MeetingsScreen from '../screens/boardroom/MeetingsScreen';
import SubScreenHeader from '../components/chrome/SubScreenHeader';

const Stack = createNativeStackNavigator();

export default function ViberStack() {
  const headerOptions = {
    headerShown: true,
    header: (props: any) => <SubScreenHeader {...props} />,
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ViberHome" component={ViberHomeScreen} />
      <Stack.Screen
        name="MessengerThread"
        component={MessengerThreadScreen}
        options={({ route }: any) => ({ ...headerOptions, headerTitle: route.params?.title || 'Message' })}
      />
      <Stack.Screen name="BoardroomHome" component={BoardroomHomeScreen} options={{ ...headerOptions, headerTitle: 'Boardroom' }} />
      <Stack.Screen name="VideoConf" component={VideoConfScreen} options={{ ...headerOptions, headerTitle: 'Live Video Minutes' }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ ...headerOptions, headerTitle: 'Announcements' }} />
      <Stack.Screen name="DirectMessages" component={DirectMessagesScreen} options={{ ...headerOptions, headerTitle: 'Direct Messages' }} />
      <Stack.Screen name="Meetings" component={MeetingsScreen} options={{ ...headerOptions, headerTitle: 'Meetings Organizer' }} />
    </Stack.Navigator>
  );
}
