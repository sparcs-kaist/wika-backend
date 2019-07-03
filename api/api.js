const express = require('express');
const moment = require('moment');

const router = express.Router();

const Destination = require('../models/destinationSchema');
const User = require('../models/userSchema');
const Request = require('../models/requestSchema');
const Party = require('../models/partySchema');

router.get('/test', (req, res) => {
  res.send('hello world!');
});


router.get('/destination', (req, res) => {
  Destination.find({})
  .then(destinations => {
    return res.json(destinations);
  });
});

router.post('/user', async (req, res) => {
  const { name } = req.body;
  console.log({ name })
  const user = await User.create({ name });
  console.log({user})
  res.json(user);
});


router.post('/userBulk', async (req, res) => {
  const { name } = req.body;
  console.log({ name })
  const users = await Promise.all([...Array(10)].map((x, i) => User.create({ name: `${name}${i}` })));
  console.log({users})
  res.json(users);
});

router.get('/user/:userName', async (req, res) => {
  const { userName } = req.params;
  try {
    const user = await User.findOne({ name: userName });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

router.get('/request/:userName', async (req, res) => {
  const { userName } = req.params;
  try {
    const user = await User.findOne({ name: userName });
    const requests = await Request.find({ owner: user._id });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

router.get('/party/:userName', async (req, res) => {
  const { userName } = req.params;
  try {
    const user = await User.findOne({ name: userName });
    const parties = await Party.find({ members: { $elemMatch: user._id } });
    res.json(parties);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

router.post('/party/done/:userName', async (req, res) => {
  const { userName } = req.params;
  try {
    const user = await User.findOne({ name: userName });
    const party = await Party.findOne({
      members: { $elemMatch: { $eq: user._id } },
      $or: [{ state: 'active' }, { state: 'full' }],
    });
    if (!party) {
      res.json({
        message: 'party not found',
      });
      return;
    }
    party.state = 'done';
    const results = await Promise.all([
      ...party.members.map((memberId) => {
        return Request.findOneAndUpdate({
          owner: memberId,
          state: 'matched',
        }, {
          state: 'done',
        }, {
          new: true,
        });
      }),
      party.save(),
    ]);
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

router.post('/party/:userName', async (req, res) => {
  const { userName } = req.params;
  const { startDate: st, endDate: et, origin, destination } = req.body;
  const limit = parseInt(req.body.limit, 10) || 0;

  const startDate = moment(st);
  const endDate = moment(et);

  console.log({
    startDate: startDate.format(),
    endDate: endDate.format(),
    origin,
    destination,
    limit,
  });
  const timeOrderViolation = endDate.isBefore(startDate.add('10', 'm'));
  try {
    const user = await User.findOne({ name: userName });
    console.log({ user });
    if (!user) {
      res.status(400).send({
        message: 'User Not Found',
      });
      return;
    }
    const userId = user._id;
    const myRequest = await Request.findOne({
      owner: userId,
      $or: [{ state: 'active' }, { state: 'matched' }],
    });
    console.log({ myRequest });

    const limitQuery2 = limit ? { limit } : {};
    console.log({
      state: 'active',
      origin,
      destination,
      startDate: { $lt: endDate.toDate() },
      endDate: { $gte: startDate.toDate() },
      ...limitQuery2,
    });
    if (myRequest) {
      await myRequest.delete();
      res.status(400).json({
        message: 'Request Already Exist',
      });
      return;
    }
    if (timeOrderViolation) {
      res.status(400).json({
        message: 'Invalid Time Order',
      });
      return;
    }
    const newRequest = new Request({
      owner: userId,
      origin,
      destination,
      startDate: startDate.toDate(),
      endDate: endDate.toDate(),
      state: 'active',
      limit: limit || 0,
    });

    const limitQuery = limit ? { limit } : {};
    const matchableParties = await Party.find({
      state: 'active',
      origin,
      destination,
      startDate: { $lte: endDate.toDate() },
      endDate: { $gte: startDate.toDate() },
      ...limitQuery,
    });
    console.log({ matchableParties, length: matchableParties.length });

    if (matchableParties.length) {
      const stats = matchableParties.map((party) => {
        const partyStart = moment(party.startDate);
        const partyEnd = moment(party.endDate);
        const commonStart = moment.max(partyStart, startDate);
        const commonEnd = moment.min(partyEnd, endDate);
        return {
          commonStart,
          commonEnd,
          diff: commonEnd.diff(commonStart),
          party,
        };
      });
      const maxDiff = stats.reduce((acc, cur) => ((acc.diff < cur.diff) ? cur : acc), { diff: 0 });
      const { party, diff, commonStart, commonEnd } = maxDiff;
      party.startDate = commonStart;
      party.endDate = commonEnd;
      party.members.push(userId);
      if (!party.limit && limit) party.limit = limit;
      if ((party.limit || 4) <= party.members.length + 1) party.state = 'full';
      newRequest.state = 'matched';
      const [saveParty,saveRequest] = await Promise.all([
        party.save(),
        newRequest.save(),
      ]); // TODO: revert if fail
      await Party.populate(saveParty, 'members');
      console.log({ party, newRequest });
      res.json({
        state: 'matched',
        party: saveParty,
        request: saveRequest,
      });
      return;
    }

    const matchableRequests = await Request.find({
      state: 'active',
      origin,
      destination,
      startDate: { $lte: endDate.toDate() },
      endDate: { $gt: startDate.toDate() },
      ...limitQuery,
    });

    console.log({ matchableRequests, length: matchableRequests.length });

    if (matchableRequests.length) {
      const stats = matchableRequests.map((request) => {
        const requestStart = moment(request.startDate);
        const requestEnd = moment(request.endDate);
        const commonStart = moment.max(requestStart, startDate);
        const commonEnd = moment.min(requestEnd, endDate);
        return {
          commonStart,
          commonEnd,
          diff: commonEnd.diff(commonStart),
          request,
        };
      });
      const maxDiff = stats.reduce((acc, cur) => ((acc.diff < cur.diff) ? cur : acc), { diff: 0 });
      const { request, diff, commonStart, commonEnd } = maxDiff;
      request.state = 'matched';
      newRequest.state = 'matched';
      const newParty = async () => {
        const newLimit = request.limit || newRequest.limit;
        const party = await Party.create({
          state: newLimit === 2 ? 'full' : 'active',
          origin,
          destination,
          limit: newLimit,
          startDate: commonStart.toDate(),
          endDate: commonEnd.toDate(),
          meetingTime: moment(commonStart.add(diff)).toDate(),
          members: [
            request.owner,
            userId,
          ],
        });
        await Party.populate(party, 'members');
        return party;
      };
      const [savedRequest, savedNewRequest, savedParty] = await Promise.all([
        request.save(),
        newRequest.save(),
        newParty(),
      ]); // TODO: revert if fail
      console.log({ request, newRequest, party: savedParty })
      res.json({
        state: 'matched',
        party: savedParty,
        request: savedNewRequest,
      });
      return;
    }
    await newRequest.save();
    console.log({ newRequest });
    res.json({
      state: 'active',
      request: newRequest,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

/*
  Request 가능 상테 : [active, canceled, matched, expired, done]
  Party 가능 상태 : [active, full, canceled, expired, done]
 */

/*
 party 신청 (시작 시간, 끝 시간, 시작지점, 도착지)

 0. Validation
  시작 시간이 현재 시간 이후인지
  자신이 갖고 있는 request가 있는지 체크 => 있으면 안됨
  끝 시간이 시작 시간보다 이후인지
  끝 시간이 현재 시간보다 최소한 10분 이상 후여야함

 1. Request를 생성함 (active 상태)
 2. 조건을 만족하는 파티 / Request가 존재하는지 체크
 3. 있으면 파티 결성 (T)
  1. Request + Request인 경우
    1. 두 request의 정보로 새로운 파티 생성
  1. Request + Party인 경우
    1. 파티에 맴버로 유저를 추가하고 시작, 끝 시간 정보를 업데이트한다.
  2. Request 정보를 'matched' 으로 변경함
  3. 맥시멈 맴버 수에 도달했는지 체크
  4. 도달 했으면
    파티의 상태를 full로 변경
  5. 푸시 알림을 파티의 모든 멤버들에게 전송!

 3. 없으면 패스
  pass
*/

/*
  request 취소

  1. 현재 갖고 있는 request 상태가 active인지 체크
  2. request 상태 취소됨으로 변경
 */
/*
 party 취소

 1. 현재 참여하고 있는 active 파티가 있는지 체크
 2. 현재 가지고 있는 matched Request가 있는지 체크
 3. 파티에서 멤버 삭제
 4. 파티의 남은 멤버가 2명 이상일 때
  1. 파티의 시작, 끝 시간을 해당 맴버의 request를 제외하고 재측정
 5. 파티의 남은 멤버가 1명일 때
  1. 파티를 취소 상태로 변경. 해당 유저의 request를 다시 active 상태로
  2. 해당 request가 다른 party와 매칭될 수 있는지 체크

 5. 요청 유저의 Request canceled로 변경

*/
/*
  히스토리

*/

/*
  1분마다 cron job

  역할 : 만료되지 않은 파티 중에서, 끝 시간을 넘어선 파티를 만료시킴

  1. active / full 상태의 파티 리스트 읽어옴
  2. 활성 상태의 request 리스트 읽어옴
  2. 끝 시간이 지났거나 5분 이하로 남은 파티 리스트를 추려냄
  2. 끝 시간이 지났거나 5분 이하로 남은 request 리스트를 추려냄
  3. 5분 이하로 남은 파티의 팀원들에게 푸시 알림을 보냄
  3. 5분 이하로 남은 request의 유저에게 푸시 알림을 보냄
  4. 시간이 만료된 파티의 맴버들에게 만료알림을 보냄
  4. 시간이 만료된 request의 소유 유저에게 만료알림을 보냄
  5. 파티의 상태를 expired로 변경. 연결된 request 모두 expired로 변경
  6. request 모두 expired로 변경
  4. 해당 파티의 유저들에게 만료 푸시 알림을 보냄
  4. 해당 request의 유저에게 만료 푸시 알림을 보냄
*/

/*
  파티 완료 요청

  1. 현재 참가중인 full 또는 active한 파티를 검색
  1. matched인 request가 있는지 확인
  3. 참가중인 party의 상태를 done으로 업데이트
  4. 파티의 doneBy에 완료 요청한 유저 id, name 기록
  4. 해당 파티의 모든 request를 done으로 변경
  5. 해당 파티의 맴버들에게 완료 푸시 알림을 보냄.
 */

module.exports = router;

